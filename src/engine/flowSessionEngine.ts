import { PrismaClient } from "@prisma/client";
import { sendStepToUser } from "../services/sendStepToUser";  // use your function
import { getFirstStep, determineNextStep } from "../services/stepNavigation"; // your existing logic

const prisma = new PrismaClient();

export const flowSessionEngine = {
  async processIncomingMessage({
    from,
    text,
    phoneNumberId,
  }: {
    from: string;
    text: string;
    phoneNumberId: string;
  }) {
    // 1. Find WhatsApp Number configuration
    const whatsappNumber = await prisma.whatsAppNumber.findFirst({
      where: { phoneNumberId, isDeleted: false },
      include: { defaultFlow: true },
    });

    if (!whatsappNumber) {
      console.error("WhatsApp number not registered in system:", phoneNumberId);
      return;
    }

    // 2. Fetch or create user (optional — depends on your schema)
    const userPhone = from;

    let user = await prisma.user.findFirst({
      where: { phone: userPhone },
    });

    if (!user) {
        throw new Error("User not found");
    }

    // 3. Fetch active session
    let session = await prisma.session.findFirst({
      where: {
        userId: user.id,
        isCompleted: false,
      },
      include: { currentStep: true },
    });

    // 4. If no session → create new session with default flow
    if (!session) {
      if (!whatsappNumber.defaultFlowId) {
        console.error("No default flow set for WhatsApp number:", phoneNumberId);
        return;
      }

      const firstStep = await getFirstStep(prisma, whatsappNumber.defaultFlowId);

      session = await prisma.session.create({
        data: {
          userId: user.id,
          flowId: whatsappNumber.defaultFlowId,
          currentStepId: firstStep?.id ?? null,
          isCompleted: false,
          createdBy: "system",
        },
        include: { currentStep: true },
      });

      // Send first step
      await sendStepToUser({
        prisma,
        session,
        step: session.currentStep,
        whatsappNumber,
      });

      return;
    }

    // 5. Session exists → find next step
    if (!session.currentStep) {
        console.error("Session has no current step, cannot determine next step");
        return;
      }
      
      const nextStep = await determineNextStep(prisma, session.currentStep, text);

    if (!nextStep) {
      // Unknown input → repeat step
      await sendStepToUser({
        prisma,
        session,
        step: session.currentStep,
        whatsappNumber,
      });
      return;
    }

    // 6. Update session with next step
    session = await prisma.session.update({
      where: { id: session.id },
      data: { currentStepId: nextStep.id },
      include: { currentStep: true },
    });

    // 7. If no more steps, complete session
    if (!nextStep) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isCompleted: true },
      });
      return;
    }

    // 8. Send next step to user
    await sendStepToUser({
      prisma,
      session,
      step: nextStep,
      whatsappNumber,
    });
  },
};

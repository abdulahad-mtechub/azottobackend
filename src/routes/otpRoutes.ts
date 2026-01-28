import express from "express";
import { sendOtp, verifyOtp } from "../services/sendOTP";

const router = express.Router();

router.post("/send", async (req, res) => {
  const { phoneNumber, businessId } = req.body;

  if (!phoneNumber || !businessId) {
    return res.status(400).json({ error: "Missing phoneNumber or businessId" });
  }

  try {
    const result = await sendOtp(phoneNumber, businessId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/verify", async (req, res) => {
  const { phoneNumberId, otp } = req.body;
  try {
    const result = await verifyOtp(phoneNumberId, Number(otp));
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

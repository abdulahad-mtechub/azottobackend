import axios from "axios";

export type VinPublicData = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
  fuelType: string | null;
  transmission: string | null;
  vehicleAge: number | null;
};

const toNullableNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const decodeVinPublicData = async (
  vin: string
): Promise<VinPublicData> => {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(
      vin
    )}?format=json`;
    const resp = await axios.get(url, { timeout: 15000 });
    const result = resp.data?.Results?.[0];
    if (!result) {
      return {
        year: null,
        make: null,
        model: null,
        trim: null,
        engine: null,
        fuelType: null,
        transmission: null,
        vehicleAge: null,
      };
    }

    const year = toNullableNumber(result.ModelYear);
    const currentYear = new Date().getFullYear();
    const vehicleAge = year ? Math.max(currentYear - year, 0) : null;

    return {
      year,
      make: result.Make || null,
      model: result.Model || null,
      trim: result.Trim || null,
      engine: result.EngineDisplacementL || result.EngineModel || null,
      fuelType: result.FuelTypePrimary || null,
      transmission: result.TransmissionStyle || null,
      vehicleAge,
    };
  } catch {
    return {
      year: null,
      make: null,
      model: null,
      trim: null,
      engine: null,
      fuelType: null,
      transmission: null,
      vehicleAge: null,
    };
  }
};

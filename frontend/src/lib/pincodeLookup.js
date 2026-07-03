// Simple pincode lookup utility using Indian postal API
// Usage: getPincodeDetails(pincode) returns { state, district } or null

export async function getPincodeDetails(pincode) {
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    if (!data || !Array.isArray(data) || !data[0].PostOffice || !data[0].PostOffice.length) return null;
    const { State, District } = data[0].PostOffice[0];
    return { state: State, district: District };
  } catch {
    return null;
  }
}

// PLACEHOLDER: Adobe Sign integration
// Replace with real Adobe Sign API when account is established.

const ADOBE_TOKEN = process.env.ADOBE_ACCESS_TOKEN;

export function isAdobeSignConfigured(): boolean {
  return !!ADOBE_TOKEN && ADOBE_TOKEN !== "placeholder";
}

export async function generateContract(partnerEmail: string, companyName: string, discountTier: string) {
  if (!isAdobeSignConfigured()) {
    console.warn("[Adobe Sign Placeholder] generateContract called without valid Adobe token");
    return {
      agreementId: "placeholder_agreement_" + Date.now(),
      status: "placeholder",
    };
  }

  // TODO: Real Adobe Sign implementation
  return {
    agreementId: "placeholder_agreement_" + Date.now(),
    status: "placeholder",
  };
}

export async function getContractStatus(agreementId: string) {
  if (!isAdobeSignConfigured()) {
    return {
      status: "placeholder",
      signedDocumentUrl: null,
    };
  }

  // TODO: Real Adobe Sign implementation
  return {
    status: "placeholder",
    signedDocumentUrl: null,
  };
}

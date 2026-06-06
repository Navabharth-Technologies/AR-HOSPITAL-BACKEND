const pdfParse = require('pdf-parse');

const parsePdfAndExtract = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    // Very basic mock extraction logic.
    // In a real scenario, we'd use regex or an AI model to parse complex bills.
    
    let PatientName = "Unknown";
    let Gender = "Unknown";
    let Age = 0;
    let MobileNumber = "Unknown";
    
    console.log("--- RAW PDF TEXT ---");
    console.log(text.substring(0, 1000));
    console.log("--------------------");

    // Since pdf-parse scrambles the table layout (keys and values are on different lines),
    // we use targeted regexes based on the expected values format rather than relying on labels.

    // Match name usually prefixed by Mr., Mrs., Ms., Miss
    const nameMatch = text.match(/(Mr\.|Mrs\.|Ms\.|Miss)\s+([A-Za-z\.\s]+)/i);
    if (nameMatch) {
      // The match group 1 is the title, group 2 will contain the name after the title
      let extractedName = nameMatch[2].trim();
      // It might grab too much if there are other lines after it, so let's clean it up by taking the first line
      extractedName = extractedName.split(/[\n\r]+/)[0].trim();
      PatientName = nameMatch[1] + " " + extractedName;
    }
    
    // Match Gender and Age like "Male/70 years"
    const genderAgeMatch = text.match(/(Male|Female|Other)\s*\/\s*(\d+)\s*years/i);
    if (genderAgeMatch) {
      Gender = genderAgeMatch[1].trim();
      Age = parseInt(genderAgeMatch[2], 10);
    }
    
    // Match Mobile No which is awkwardly formatted like "9901752216Mobile No" or just a 10 digit number near "Mobile No"
    const mobileMatch = text.match(/(\+?\d[\d\s-]{8,14}\d)\s*Mobile No/i) || text.match(/Mobile No\s*[\n\r]*\s*(\+?\d[\d\s-]{8,14}\d)/i);
    if (mobileMatch) {
      MobileNumber = mobileMatch[1].trim();
    } else {
      // Fallback: look for any 10-digit number that isn't a date or standard other number
      // This is risky but works for disjointed text
      const fallbackMobile = text.match(/\b([6-9]\d{9})\b/);
      if (fallbackMobile) {
        MobileNumber = fallbackMobile[1];
      }
    }

    return {
      PatientName,
      Gender,
      Age,
      MobileNumber,
      rawText: text.substring(0, 500) // Return some raw text for debugging if needed
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF');
  }
};

module.exports = {
  parsePdfAndExtract
};

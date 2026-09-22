/*
 * Study configuration. These placeholders are filled in before data collection.
 *
 *   ENDPOINT_URL             Google Apps Script web-app URL that receives the session
 *                            payload (see apps-script.gs + README § "Data endpoint").
 *                            Leave "" to run the study in offline/preview mode —
 *                            participants then get the JSON download fallback.
 *   PROLIFIC_COMPLETION_URL  Prolific completion/redirect URL shown after submit.
 *   PROLIFIC_COMPLETION_CODE Manual completion code participants can report on
 *                            Prolific (always displayed on the final screen).
 *   PROLIFIC_RETURN_CODE     Code shown on the "incompatible device" screen so a
 *                            screened-out participant can return their submission.
 *   SHOW_FAMILIARITY_RECAP   Set false to skip the per-trial familiarity recap page.
 */
const CONFIG = {
  ENDPOINT_URL: "",
  PROLIFIC_COMPLETION_URL: "",
  PROLIFIC_COMPLETION_CODE: "C1A2B3C4",
  PROLIFIC_RETURN_CODE: "R9T8Y7U6",
  SHOW_FAMILIARITY_RECAP: true
};

if (typeof module !== "undefined") module.exports = { CONFIG };

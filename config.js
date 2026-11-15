/* Study configuration. Fill in before data collection.
 *   ENDPOINT_URL   Google Apps Script web-app URL (see README, "Data endpoint").
 *                  Empty string = preview mode: nothing is sent, the data can be downloaded as JSON.
 *   CONTACT        Name and e-mail shown on the consent and debriefing screens.
 *   MIN_WIDTH      Minimum window width in pixels (phones are turned away).
 */
const CONFIG = {
  ENDPOINT_URL: "",
  CONTACT: "Uddeshya Singh, Hochschule Neu-Ulm (add e-mail address here)",
  MIN_WIDTH: 900,
  STUDY_VERSION: "v2.1-2026-11-16"
};
if (typeof module !== "undefined") module.exports = { CONFIG };

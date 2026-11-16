/* Study configuration.
 *   ENDPOINT_URL   Google Apps Script web-app URL ending in /exec (README, "Data endpoint").
 *                  Empty string = preview mode: nothing is sent, the data can be downloaded as JSON.
 *   RESEARCHER     Name shown in "About this study".
 *   EMAIL          Contact address shown to participants.
 *   SHOW_LOGO      Show the university logo (assets/hnu-logo.png) in the page header.
 *   MIN_WIDTH      Minimum window width in pixels (phones are turned away).
 */
const CONFIG = {
  ENDPOINT_URL: "",
  RESEARCHER: "Uddeshya Singh",
  EMAIL: "uddeshya.singh@student.hnu.de",
  SHOW_LOGO: true,
  MIN_WIDTH: 900,
  STUDY_VERSION: "v2.2-2026-11-16"
};
if (typeof module !== "undefined") module.exports = { CONFIG };

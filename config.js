/* Study configuration.
 *   ENDPOINT_URL   Google Apps Script web-app URL ending in /exec (README, "Data endpoint").
 *                  Empty string = preview mode: nothing is sent, the data can be downloaded as JSON.
 *   RESEARCHER     Name shown in "About this study".
 *   EMAIL          Contact address shown to participants.
 *   SHOW_LOGO      Show the university logo (assets/hnu-logo.png) in the page header.
 *   LANGUAGES      Languages offered. The first visit starts in German when the browser language is German,
 *                  otherwise in English; the participant can switch at any time. ["en"] hides the switch.
 *   MIN_WIDTH      Minimum window width in pixels (phones are turned away).
 */
const CONFIG = {
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbwa3h1yjsMKIgUfV0SqqofQBoUASGQgcKvmrSInK6XFwYGeeyr3swBz0u2q4RmFO-3r-w/exec",
  RESEARCHER: "Uddeshya Singh",
  EMAIL: "uddeshya.singh@student.hnu.de",
  SHOW_LOGO: true,
  LANGUAGES: ["en", "de"],
  MIN_WIDTH: 900,
  STUDY_VERSION: "v2.4-2026-11-17"
};
if (typeof module !== "undefined") module.exports = { CONFIG };

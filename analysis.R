# Confirmatory analysis for H1-H3. Input: the "trials" sheet exported as trials.csv,
# the "sessions" sheet exported as sessions.csv.
library(lme4)
d <- read.csv("trials.csv"); s <- read.csv("sessions.csv")
s <- s[!grepl("^selftest-", s$session_id) & !(s$src %in% c("demo", "test")), ]   # test and demonstration sessions are not data
s <- s[toupper(as.character(s$final)) == "TRUE", ]                                  # only finished sessions; a partial row can carry questionnaire answers
d <- d[d$session_id %in% s$session_id, ]
d$trace <- factor(d$trace, levels = c(0, 1), labels = c("no trace", "trace"))
# device class: from the "device" event that the page logs at the start (events.csv = the "events" sheet); desktop = no touch or a fine primary pointer,
# phone = touch with a screen side shorter than 600 px, tablet = other touch devices. Without events.csv the browser identification string is used instead.
s$device <- ifelse(grepl("iPhone|iPod|Mobi", s$user_agent), "phone", ifelse(grepl("iPad|Android|Tablet", s$user_agent), "tablet", "desktop"))
if (file.exists("events.csv")) {
  library(jsonlite)
  ev <- read.csv("events.csv", stringsAsFactors = FALSE); ev <- ev[ev$type == "device" & !duplicated(ev$session_id), ]
  dv <- do.call(rbind, lapply(seq_len(nrow(ev)), function(i) { p <- fromJSON(ev$payload_json[i])
    data.frame(session_id = ev$session_id[i], cls = if (p$touch_points == 0 || !isTRUE(p$pointer_coarse)) "desktop" else if (min(p$sw, p$sh) < 600) "phone" else "tablet", stringsAsFactors = FALSE) }))
  s$device <- ifelse(s$session_id %in% dv$session_id, dv$cls[match(s$session_id, dv$session_id)], s$device)
}
d$device <- s$device[match(d$session_id, s$session_id)]
print(table(s$device))   # completed sessions by device class

fit <- function(formula, data) {
  m <- tryCatch(glmer(formula, data = data, family = binomial, control = glmerControl(optimizer = "bobyqa")), error = function(e) NULL)
  if (is.null(m) || isSingular(m))   # drop the random slope first, as stated in Section 4.6
    m <- glmer(update(formula, . ~ trace + (1 | session_id) + (1 | item)), data = data, family = binomial, control = glmerControl(optimizer = "bobyqa"))
  m
}
report <- function(m) { ci <- confint(m, parm = "tracetrace", method = "Wald"); print(summary(m)); cat("Odds ratio:", exp(fixef(m)["tracetrace"]), " 95% CI:", exp(ci), "\n") }

h1 <- fit(opened_any ~ trace + (1 + trace | session_id) + (1 | item), d);                      report(h1)   # H1 initiation
u  <- d[d$supported == 0, ]
h2 <- fit(I(decision == "reject") ~ trace + (1 + trace | session_id) + (1 | item), u);         report(h2)   # H2 rejection
h3 <- fit(verification_success ~ trace + (1 + trace | session_id) + (1 | item), u);            report(h3)   # H3 verification success

# percentage-point differences (descriptive, by condition)
print(aggregate(cbind(opened_any, correct) ~ trace, d, mean)); print(aggregate(cbind(rejected = decision == "reject", verification_success) ~ trace, u, mean))
# carryover: does the effect of the trace change over the session?
print(summary(glmer(opened_any ~ trace * scale(trial_index) + (1 | session_id) + (1 | item), d, family = binomial)))
# say versus click: reported against logged number of checked answers, and stated trust by condition
print(cor.test(s$self_checked, s$logged_checked)); print(summary(s$self_checked - s$logged_checked)); print(t.test(s$trust_trace, s$trust_notrace, paired = TRUE))
# device class: covariate and sensitivity analysis (phones, tablets and desktops differ in how sources are opened and in away time)
print(summary(glmer(opened_any ~ trace + device + (1 | session_id) + (1 | item), d, family = binomial)))
print(summary(glmer(opened_any ~ trace * device + (1 | session_id) + (1 | item), d, family = binomial)))
dd <- d[d$device == "desktop", ]   # H1 on desktop sessions only
if (nrow(dd) > 0) tryCatch(report(fit(opened_any ~ trace + (1 + trace | session_id) + (1 | item), dd)), error = function(e) cat("Desktop-only model could not be estimated:", conditionMessage(e), "\n"))
# exposure: time each region was in view per question (events.csv = the "events" sheet; the trial_end payload holds view_ms and first_seen_ms)
if (file.exists("events.csv")) {
  library(jsonlite)
  e <- read.csv("events.csv"); e <- e[e$type == "trial_end" & e$item != "practice" & e$session_id %in% d$session_id, ]
  v <- do.call(rbind, lapply(e$payload_json, function(x) { p <- fromJSON(x); if (is.null(p$view_ms)) NULL else data.frame(sources = p$view_ms$sources, trace = p$view_ms$trace, decision = p$view_ms$decision) }))   # records from older study versions have no view_ms
  print(summary(v))
}

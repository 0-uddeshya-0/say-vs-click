# Confirmatory analysis for H1-H3. Input: the "trials" sheet exported as trials.csv,
# the "sessions" sheet exported as sessions.csv.
library(lme4)
d <- read.csv("trials.csv"); s <- read.csv("sessions.csv")
s <- s[!grepl("^selftest-", s$session_id) & !(s$src %in% c("demo", "test")), ]   # test and demonstration sessions are not data
d <- d[d$session_id %in% s$session_id[s$final == TRUE], ]
d$trace <- factor(d$trace, levels = c(0, 1), labels = c("no trace", "trace"))

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

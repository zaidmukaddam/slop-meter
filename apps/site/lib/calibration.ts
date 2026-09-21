import report from "@slop/eval/report.json"
import reportLm from "@slop/eval/report-lm.json"

export type Report = typeof report | typeof reportLm
export const REPORT: Report = report
export const REPORT_LM: Report = reportLm

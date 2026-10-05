#!/usr/bin/env bash
# J.A.R.V.I.S. HUD status line for Claude Code.
# Reads the session JSON Claude Code pipes on stdin and renders a two-line HUD.

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  printf '\033[38;5;45m◉ J.A.R.V.I.S.\033[0m  \033[38;5;214minstall jq to bring the HUD online\033[0m\n'
  exit 0
fi

j() { jq -r "$1 // empty" <<<"$input" 2>/dev/null; }

model=$(j '.model.display_name')
dir=$(j '.workspace.current_dir // .cwd')
style=$(j '.output_style.name')
ctx=$(j '.context_window.used_percentage')
cost=$(j '.cost.total_cost_usd')
added=$(j '.cost.total_lines_added')
removed=$(j '.cost.total_lines_removed')

project=$(basename "${dir:-$PWD}")
branch=$(git -C "${dir:-.}" branch --show-current 2>/dev/null)

# Palette: arc-reactor cyan, Stark gold, hot-rod red, dim steel.
C=$'\033[38;5;45m'; B=$'\033[1;38;5;51m'; G=$'\033[38;5;214m'
R=$'\033[38;5;196m'; D=$'\033[38;5;244m'; X=$'\033[0m'

# Arc reactor pulses with the clock.
frames=("◉" "◎" "○" "◎")
reactor=${frames[$(( $(date +%s) % 4 ))]}

# Power-cell bar for context usage: fills as the context window is spent.
ctx_int=${ctx%.*}; ctx_int=${ctx_int:-0}
filled=$(( ctx_int / 10 )); (( filled > 10 )) && filled=10
bar=""
for ((i = 0; i < 10; i++)); do
  if (( i < filled )); then bar+="▰"; else bar+="▱"; fi
done
if   (( ctx_int >= 80 )); then bc=$R
elif (( ctx_int >= 50 )); then bc=$G
else bc=$C; fi

hour=$(date +%H)
if   (( 10#$hour < 12 )); then greet="Good morning"
elif (( 10#$hour < 18 )); then greet="Good afternoon"
else greet="Good evening"; fi

line1="${B}${reactor} J.A.R.V.I.S.${X} ${D}│${X} ${C}${model:-online}${X}"
[[ -n $style && $style != "JARVIS" ]] && line1+=" ${D}(${style})${X}"
line1+=" ${D}│${X} ${G}⌁ ${project}${X}"
[[ -n $branch ]] && line1+="${D}@${X}${C}${branch}${X}"

line2="${D}POWER${X} ${bc}${bar}${X} ${D}${ctx_int}%${X}"
[[ -n $cost ]] && line2+=" ${D}│${X} ${G}\$$(printf '%.2f' "$cost")${X}"
[[ -n $added || -n $removed ]] && line2+=" ${D}│${X} ${C}+${added:-0}${X}${D}/${X}${R}-${removed:-0}${X}"
line2+=" ${D}│ ${greet}, Santino · $(date +%H:%M)${X}"

printf '%s\n%s\n' "$line1" "$line2"

#!/usr/bin/env python3
"""Extract a readable answer + transcript from a Hermes session JSON.

Hermes only prints the *final assistant prose* to stdout; if a run ends on a
tool call (common for chatty agents that hit a turn cap), stdout is empty and
the work survives only in the session file. This pulls the real content out.

Usage: extract_session.py <session.json> <run_dir>
Writes <run_dir>/answer.md and <run_dir>/session_transcript.md; prints a
one-line summary (turns / tool calls / final-answer length) to stdout.
"""
import json, sys, os

def tool_cmd(m):
    for tc in (m.get("tool_calls") or []):
        try:
            args = json.loads(tc["function"]["arguments"])
            return args.get("command") or args.get("code") or json.dumps(args)
        except Exception:
            return str(tc)
    return ""

def main():
    sess, run_dir = sys.argv[1], sys.argv[2]
    d = json.load(open(sess))
    msgs = d.get("messages", [])
    asst = [m for m in msgs if m.get("role") == "assistant"]
    tool_turns = sum(1 for m in asst if m.get("tool_calls"))
    reason_chars = sum(len(str(m.get("reasoning_content") or "")) for m in msgs)

    # final answer = last assistant message that actually carries prose
    final = ""
    for m in reversed(asst):
        if (m.get("content") or "").strip():
            final = m["content"].strip(); break

    with open(os.path.join(run_dir, "answer.md"), "w") as f:
        if final:
            f.write(final + "\n")
        else:
            f.write("(NO FINAL PROSE — the run ended on a tool call / empty "
                    "completion. The agent never wrote a report. See "
                    "session_transcript.md for what it did.)\n")

    with open(os.path.join(run_dir, "session_transcript.md"), "w") as f:
        f.write(f"# Session transcript ({os.path.basename(sess)})\n\n")
        f.write(f"messages: {len(msgs)} · assistant turns: {len(asst)} · "
                f"tool-call turns: {tool_turns} · reasoning chars: {reason_chars}\n\n")
        for i, m in enumerate(msgs):
            role = m.get("role")
            if role == "assistant":
                c = (m.get("content") or "").strip()
                cmd = tool_cmd(m)
                if c:
                    f.write(f"## [{i}] assistant\n{c}\n\n")
                if cmd:
                    f.write(f"## [{i}] assistant → tool\n```\n{cmd[:1500]}\n```\n\n")
            elif role == "tool":
                out = (m.get("content") or "")[:1200]
                f.write(f"## [{i}] tool output\n```\n{out}\n```\n\n")

    print(f"turns={len(asst)} tool_turns={tool_turns} reasoning_chars={reason_chars} "
          f"final_answer_chars={len(final)}")

if __name__ == "__main__":
    main()

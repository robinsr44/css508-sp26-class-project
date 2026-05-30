import { useEffect, useState } from "react";
import { isValidTimeHhMm } from "./locationTime";

interface TimeInput24Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-describedby"?: string;
}

/** Text input that always shows and accepts wall-clock times as HH:MM (24-hour). */
export default function TimeInput24({ id, value, onChange, "aria-describedby": ariaDescribedBy }: TimeInput24Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className="time-input-24"
      placeholder="HH:MM"
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      maxLength={5}
      aria-describedby={ariaDescribedBy}
      value={draft}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d:]/g, "").slice(0, 5);
        setDraft(next);
        if (isValidTimeHhMm(next)) {
          onChange(next);
        }
      }}
      onBlur={() => {
        if (!isValidTimeHhMm(draft)) {
          setDraft(value);
          return;
        }
        onChange(draft);
      }}
    />
  );
}

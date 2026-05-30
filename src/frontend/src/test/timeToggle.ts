import { screen, within } from "@testing-library/react";

export function formTimeEntryGroup() {
  return within(screen.getByRole("group", { name: "Time entry" }));
}

export function resultTimeDisplayGroup() {
  return within(screen.getByRole("group", { name: "Time display" }));
}

export async function useUtcTimeEntry(user: { click: (el: Element) => Promise<void> }) {
  await user.click(formTimeEntryGroup().getByRole("button", { name: /^UTC$/ }));
}

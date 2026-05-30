import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export async function fillCoordinates(user: UserEvent, lat: string, lon: string) {
  await user.clear(screen.getByLabelText(/latitude/i));
  await user.type(screen.getByLabelText(/latitude/i), lat);
  await user.clear(screen.getByLabelText(/longitude/i));
  await user.type(screen.getByLabelText(/longitude/i), lon);
}

export async function seedSeattleCoordinates(user: UserEvent) {
  await fillCoordinates(user, "47.6062", "-122.3321");
}

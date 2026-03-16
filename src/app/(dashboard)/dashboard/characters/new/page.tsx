import { redirect } from "next/navigation";

export default function DashboardCharacterNewRedirect() {
  redirect("/characters/create");
}

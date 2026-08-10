import { redirect } from "next/navigation";

export default function LegacyCandidateReviewRedirect() {
  redirect("/generate");
}

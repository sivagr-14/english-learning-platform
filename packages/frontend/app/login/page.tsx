import { LoginForm } from "./LoginForm";
import AuthShell from "@/components/AuthShell";
export default function Page() {
  return (
    <AuthShell
      title="Welcome back."
      description="Pick up where you left off and keep your English moving."
    >
      <LoginForm />
    </AuthShell>
  );
}

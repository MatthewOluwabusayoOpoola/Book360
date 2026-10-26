import { SignUp } from "@clerk/nextjs";
import { AuthShell, clerkLook } from "@/components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp appearance={clerkLook} />
    </AuthShell>
  );
}

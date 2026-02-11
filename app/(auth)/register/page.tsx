import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Register
      </h1>
      <RegisterForm />
    </div>
  );
}

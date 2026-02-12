import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Register
      </h1>
      <RegisterForm />
    </div>
  );
}

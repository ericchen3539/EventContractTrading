import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        忘记密码
      </h1>
      <ForgotPasswordForm />
    </div>
  );
}

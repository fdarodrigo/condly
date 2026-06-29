import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wordmark } from '@/components/layout/wordmark';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 size-96 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          <Wordmark tamanho="lg" />
          <CardTitle className="font-normal text-muted-foreground">
            Entre com seu e-mail e senha
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-8">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}

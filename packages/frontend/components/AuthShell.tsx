import Link from "next/link";
import { ReactNode } from "react";
import Icon from "./Icon";
export default function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Mastery Skills">
        <div>
          <Link className="brand" href="/login">
            <span className="brand-mark">
              <Icon name="book" />
            </span>
            <span>
              Mastery Skills<small>Make yourself understood.</small>
            </span>
          </Link>
        </div>
        <div>
          <h2>
            Find the words.
            <br />
            Make them yours.
          </h2>
          <p>
            Useful expressions. Meaningful conversations. A little practice that
            stays with you.
          </p>
        </div>
        <div className="text-xs text-emerald-100">
          Understand · Practise · Remember
        </div>
      </section>
      <section className="auth-content">
        <div className="auth-card">
          <p className="eyebrow mb-3">Your learning space</p>
          <h1>{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

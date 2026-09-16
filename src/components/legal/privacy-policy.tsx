import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { BRAND } from "@/lib/brand";

const UPDATED = "16 Σεπτεμβρίου 2026";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link href="/" className="inline-flex items-center">
            <BrandLockup className="h-8 max-w-[220px]" />
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-white/55 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-white/40">
          Ads Pro Digital · GDPR
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
          Προσωπικά δεδομένα / GDPR
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          {BRAND.name} είναι το προϊόν marketing desk στο {BRAND.domain}. Αυτή η
          σελίδα αφορά μόνο αυτή την εφαρμογή — όχι καταστήματα τρίτων που
          συνδέονται ως brands.
        </p>
        <p className="mt-2 text-sm text-white/40">
          Κανονικό URL:{" "}
          <span className="text-white/70">{BRAND.privacyUrl}</span>
        </p>
        <p className="mt-1 text-sm text-white/40">Τελευταία ενημέρωση: {UPDATED}</p>

        <div className="mt-14 space-y-12 text-[15px] leading-7 text-white/70">
          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Υπεύθυνος επεξεργασίας
            </h2>
            <p className="mt-3">
              Υπεύθυνος επεξεργασίας των δεδομένων που συλλέγει αυτό το website
              είναι ο φορέας του προϊόντος {BRAND.name} ({BRAND.siteUrl}).
            </p>
            <p className="mt-3" data-testid="controller-unknown">
              Νομική επωνυμία / έδρα / ΑΦΜ: [UNKNOWN — να συμπληρωθεί από τον
              υπεύθυνο φορέα. Δεν εφευρίσκονται στοιχεία εταιρείας.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Τι δεδομένα επεξεργαζόμαστε
            </h2>
            <p className="mt-3">
              Όταν δημιουργείτε λογαριασμό ή συνδέεστε, επεξεργαζόμαστε στοιχεία
              λογαριασμού (email, όνομα) μέσω Supabase Auth, ιδιότητα μέλους σε
              organization, ρόλους και session cookies.
            </p>
            <p className="mt-3">
              Όταν συνδέετε ad platforms από το Connections desk,
              αποθηκεύουμε OAuth tokens (κρυπτογραφημένα) και εισάγουμε μετρικά
              καμπανιών / καταστήματος που εσείς επιλέγετε να συγχρονίσετε. Το
              Meta write desk, όπου έχει εξουσιοδοτηθεί, τηρεί audit εγγραφές.
            </p>
            <p className="mt-3">
              Τεχνικά logs (ασφάλεια, σφάλματα, rate limiting) μπορεί να
              περιλαμβάνουν διεύθυνση IP και User-Agent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Σκοποί και νομική βάση
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Παροχή του {BRAND.name} desk (εκτέλεση σύμβασης, άρθρ. 6 παρ. 1
                β΄ GDPR).
              </li>
              <li>
                Σύνδεση connectors (Meta, Google, TikTok, WooCommerce κ.λπ.)
                κατόπιν δικής σας ενέργειας (συναίνεση / εκτέλεση σύμβασης).
              </li>
              <li>
                Ασφάλεια, καταπολέμηση κατάχρησης, διατήρηση audit (έννομο
                συμφέρον, άρθρ. 6 παρ. 1 στ΄ GDPR).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Αποδέκτες
            </h2>
            <p className="mt-3">
              Εκτελούντες επεξεργασία που υποστηρίζουν την εφαρμογή: Supabase
              (authentication και βάση), η υποδομή φιλοξενίας του {BRAND.domain}.
              Οι πλατφόρμες διαφημίσεων (Meta, Google, TikTok) λαμβάνουν δεδομένα
              μόνο όταν εσείς κάνετε OAuth connect.
            </p>
            <p className="mt-3">
              Δεν πουλάμε προσωπικά δεδομένα. Δεν χρησιμοποιούμε αυτή τη σελίδα
              ως πολιτική καταστήματος τρίτου brand.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Χρόνος διατήρησης
            </h2>
            <p className="mt-3">
              Τα δεδομένα λογαριασμού και σύνδεσης διατηρούνται όσο υπάρχει ο
              λογαριασμός, εκτός αν ισχύει μεγαλύτερη υποχρέωση από τον νόμο.
              Ακριβείς προθεσμίες ανά κατηγορία: [UNKNOWN — να συμπληρωθεί όταν
              οριστεί πολιτική διατήρησης].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Δικαιώματα
            </h2>
            <p className="mt-3">
              Έχετε δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού,
              φορητότητας και εναντίωσης, καθώς και καταγγελίας στην Αρχή
              Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (
              <a
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                href="https://www.dpa.gr"
                rel="noreferrer"
              >
                dpa.gr
              </a>
              ).
            </p>
            <p className="mt-3">
              Αιτήματα: από τον συνδεδεμένο λογαριασμό {BRAND.name}, ή στο κανάλι
              επικοινωνίας του φορέα όταν οριστεί. Email υπευθύνου: [UNKNOWN —
              να συμπληρωθεί].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Cookies
            </h2>
            <p className="mt-3">
              Χρησιμοποιούμε απαραίτητα session cookies (http-only) για
              αυθεντικοποίηση. Δεν τρέχουμε διαφημιστικά cookies τρίτων σε αυτή
              τη σελίδα.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <span>{BRAND.privacyUrl}</span>
        </div>
      </footer>
    </div>
  );
}

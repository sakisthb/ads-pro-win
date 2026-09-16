import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { BRAND } from "@/lib/brand";

const UPDATED = "16 Σεπτεμβρίου 2026";

export function TermsOfUse() {
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
          Ads Pro Digital · Terms of Use
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
          Όροι χρήσης
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          {BRAND.name} είναι το προϊόν marketing desk στο {BRAND.domain}. Αυτοί
          οι όροι αφορούν μόνο αυτή την εφαρμογή — όχι καταστήματα τρίτων που
          συνδέονται ως brands.
        </p>
        <p className="mt-2 text-sm text-white/40">
          Κανονικό URL:{" "}
          <span className="text-white/70">{BRAND.termsUrl}</span>
        </p>
        <p className="mt-1 text-sm text-white/40">Τελευταία ενημέρωση: {UPDATED}</p>

        <div className="mt-14 space-y-12 text-[15px] leading-7 text-white/70">
          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Φορέας
            </h2>
            <p className="mt-3">
              Η υπηρεσία παρέχεται από τον φορέα του προϊόντος {BRAND.name} (
              {BRAND.siteUrl}).
            </p>
            <p className="mt-3" data-testid="controller-unknown">
              Νομική επωνυμία / έδρα / ΑΦΜ: [UNKNOWN — να συμπληρωθεί από τον
              υπεύθυνο φορέα. Δεν εφευρίσκονται στοιχεία εταιρείας.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Αποδοχή
            </h2>
            <p className="mt-3">
              Η πρόσβαση ή χρήση του {BRAND.name} σημαίνει ότι αποδέχεστε αυτούς
              τους όρους. Αν δεν συμφωνείτε, μην χρησιμοποιείτε την υπηρεσία.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Περιγραφή υπηρεσίας
            </h2>
            <p className="mt-3">
              Το {BRAND.name} είναι desk για paid marketing: προβολή καμπανιών,
              μετρικών, αποδόσεων καταστήματος και σύνδεση ad platforms που εσείς
              εξουσιοδοτείτε. Δεν είναι νομική συμβουλή, ούτε εγγύηση απόδοσης
              διαφημίσεων.
            </p>
            <p className="mt-3">
              Οι πλατφόρμες διαφημίσεων παραμένουν read-only, εκτός από Meta Ads
              writes που γίνονται μόνο με ρητή εξουσιοδότηση operator
              (ads_management, επιβεβαίωση στο UI, audit). Catalog / WordPress
              writes δεν εκτελούνται από αυτό το προϊόν.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Λογαριασμοί και αποδεκτή χρήση
            </h2>
            <p className="mt-3">
              Είστε υπεύθυνοι για τα διαπιστευτήρια του λογαριασμού σας, για τις
              συνδέσεις OAuth που ενεργοποιείτε, και για τη συμμόρφωση με τους
              όρους των τρίτων πλατφορμών (Google, Meta, TikTok κ.λπ.).
            </p>
            <p className="mt-3">
              Απαγορεύεται η κατάχρηση, η παράκαμψη ασφαλείας, η πρόσβαση σε
              δεδομένα άλλων οργανισμών, και η χρήση της υπηρεσίας για παράνομο
              σκοπό.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Πνευματική ιδιοκτησία
            </h2>
            <p className="mt-3">
              Το λογισμικό, το brand και η διεπαφή του {BRAND.name} ανήκουν στον
              φορέα του προϊόντος. Τα δεδομένα καμπανιών και καταστήματος που
              συνδέετε παραμένουν δικά σας ή των αντίστοιχων πλατφορμών.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Αποποίηση και ευθύνη
            </h2>
            <p className="mt-3">
              Η υπηρεσία παρέχεται «ως έχει». Δεν εγγυόμαστε αδιάλειπτη λειτουργία,
              ακρίβεια εισαγόμενων μετρικών τρίτων, ή εμπορικό αποτέλεσμα.
            </p>
            <p className="mt-3">
              Στον βαθμό που επιτρέπει ο νόμος, ο φορέας δεν ευθύνεται για έμμεσες
              ή επακόλουθες ζημίες από τη χρήση του desk. Ακριβές όριο ευθύνης:
              [UNKNOWN — να συμπληρωθεί όταν οριστεί από τον φορέα].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Καταγγελία
            </h2>
            <p className="mt-3">
              Μπορείτε να σταματήσετε τη χρήση ανά πάσα στιγμή. Ο φορέας μπορεί
              να αναστείλει ή να τερματίσει πρόσβαση σε περίπτωση παράβασης όρων
              ή κινδύνου ασφαλείας.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Προσωπικά δεδομένα
            </h2>
            <p className="mt-3">
              Η επεξεργασία προσωπικών δεδομένων περιγράφεται στην πολιτική{" "}
              <Link
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                href={BRAND.privacyPath}
              >
                Προσωπικά δεδομένα / GDPR
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Εφαρμοστέο δίκαιο
            </h2>
            <p className="mt-3">
              Εφαρμοστέο δίκαιο: δίκαιο της Ελληνικής Δημοκρατίας, εκτός αν
              αναγκαστικός κανόνας ορίζει διαφορετικά. Αρμόδια δικαστήρια:
              [UNKNOWN — να συμπληρωθεί όταν οριστεί έδρα του φορέα].
            </p>
            <p className="mt-3">
              Επικοινωνία: από τον συνδεδεμένο λογαριασμό {BRAND.name}, ή στο
              κανάλι του φορέα όταν οριστεί. Email: [UNKNOWN — να συμπληρωθεί].
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <span>{BRAND.termsUrl}</span>
        </div>
      </footer>
    </div>
  );
}

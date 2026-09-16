import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfessionalNavbar } from "../ProfessionalNavbar";
import { useHasMounted } from "@/hooks/use-has-mounted";

jest.mock("@/hooks/use-has-mounted", () => ({
  useHasMounted: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: jest.fn(),
    resolvedTheme: "dark",
  }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: jest.fn() },
  }),
}));

jest.mock("../OrgSwitcher", () => ({
  OrgSwitcher: () => <div data-testid="org-switcher" />,
}));

jest.mock("@/components/command-palette", () => ({
  openCommandPalette: jest.fn(),
}));

jest.mock("@/components/providers/chrome-locale", () => ({
  useChromeLocale: () => ({
    locale: "en",
    setLocale: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/providers/currency", () => ({
  useCurrency: () => ({ currency: "EUR" }),
}));

jest.mock("@/hooks/use-active-org", () => ({
  useActiveOrg: () => ({
    org: { plan: "pro" },
    isDemo: false,
  }),
}));

jest.mock("@/components/providers/trpc-provider", () => ({
  api: {
    alerts: {
      unreadCount: {
        useQuery: () => ({ data: 0 }),
      },
    },
  },
}));

const useHasMountedMock = useHasMounted as jest.MockedFunction<typeof useHasMounted>;

describe("ProfessionalNavbar brand chrome", () => {
  it("renders the Ads Pro Digital wordmark instead of purple-gradient text", () => {
    useHasMountedMock.mockReturnValue(true);
    render(<ProfessionalNavbar email="kate@example.com" />);

    const logo = screen.getByRole("img", { name: /ads pro digital/i });
    expect(logo).toHaveAttribute("src", "/adpd-logo-wordmark.png");
    expect(screen.queryByText(/^Ads Pro Digital$/)).not.toBeInTheDocument();
  });
});

describe("ProfessionalNavbar user menu hydration", () => {
  it("renders a non-Radix avatar button before hydration completes", () => {
    useHasMountedMock.mockReturnValue(false);

    render(<ProfessionalNavbar email="kate@example.com" />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger).toHaveTextContent("K");
    expect(trigger).not.toHaveAttribute("data-state");
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger.id).not.toMatch(/^radix-/);
  });

  it("mounts the Radix user menu after hydration and keeps the initial", async () => {
    useHasMountedMock.mockReturnValue(true);
    const user = userEvent.setup();
    render(<ProfessionalNavbar email="kate@example.com" />);

    const trigger = await screen.findByRole("button", { name: /account menu/i });
    expect(trigger).toHaveTextContent("K");

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    });

    await user.click(trigger);
    expect(await screen.findByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });
});

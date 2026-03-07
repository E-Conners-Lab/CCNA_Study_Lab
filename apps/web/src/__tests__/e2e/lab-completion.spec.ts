import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper: type commands into the IOS terminal one by one
// ---------------------------------------------------------------------------

async function typeIOSCommands(page: Page, commands: string[]) {
  const input = page.locator('input[spellcheck="false"]');
  await expect(input).toBeVisible({ timeout: 10000 });

  for (const cmd of commands) {
    await input.fill(cmd);
    await input.press("Enter");
    // Small delay to let state update
    await page.waitForTimeout(100);
  }
}

/**
 * Converts full commands to IOS shorthand.
 * This tests that the validator's expandCommand handles abbreviations.
 */
function toShorthand(commands: string[]): string[] {
  return commands.map((cmd) => {
    let s = cmd;
    // Interface names
    s = s.replace(/GigabitEthernet/gi, "Gi");
    s = s.replace(/FastEthernet/gi, "Fa");
    s = s.replace(/Serial/gi, "Se");
    s = s.replace(/Loopback/gi, "Lo");
    s = s.replace(/Port-channel/gi, "Po");
    // Common keywords
    s = s.replace(/\bconfigure terminal\b/gi, "conf t");
    s = s.replace(/\bswitchport\b/gi, "sw");
    s = s.replace(/\binterface range\b/gi, "int range");
    s = s.replace(/\binterface\b/gi, "int");
    s = s.replace(/\bno shutdown\b/gi, "no shut");
    s = s.replace(/\bencapsulation\b/gi, "encap");
    s = s.replace(/\bchannel-group\b/gi, "channel-group");
    s = s.replace(/\bpassive-interface\b/gi, "passive-int");
    s = s.replace(/\bnetwork\b/gi, "net");
    s = s.replace(/\brouter-id\b/gi, "router-id");
    s = s.replace(/\brouter ospf\b/gi, "router ospf");
    s = s.replace(/\baccess-list\b/gi, "access-list");
    s = s.replace(/\baccess-group\b/gi, "access-group");
    s = s.replace(/\baccess-class\b/gi, "access-class");
    s = s.replace(/\btransport\b/gi, "trans");
    s = s.replace(/\bexec-timeout\b/gi, "exec-timeout");
    s = s.replace(/\bservice password-encryption\b/gi, "service password-encryption");
    s = s.replace(/\bhostname\b/gi, "ho");
    s = s.replace(/\bip domain-name\b/gi, "ip domain-name");
    s = s.replace(/\bcrypto key generate rsa\b/gi, "crypto key generate rsa");
    s = s.replace(/\bip ssh version\b/gi, "ip ssh ver");
    s = s.replace(/\busername\b/gi, "username");
    s = s.replace(/\bprivilege\b/gi, "priv");
    s = s.replace(/\bsecret\b/gi, "secret");
    s = s.replace(/\blogin local\b/gi, "log loc");
    s = s.replace(/\blogin\b/gi, "login");
    s = s.replace(/\benable secret\b/gi, "enable secret");
    return s;
  });
}

// ---------------------------------------------------------------------------
// Lab solutions — the commands needed to pass each lab
// ---------------------------------------------------------------------------

const IOS_LABS: {
  slug: string;
  title: string;
  /** Whether the lab has multiple device sections */
  multiDevice: boolean;
  /** Solution commands per device. For single device, use one array. */
  devices: { marker?: string; hostname: string; commands: string[] }[];
}[] = [
  {
    slug: "vlan-config",
    title: "VLAN and Inter-VLAN Routing",
    multiDevice: true,
    devices: [
      {
        marker: "SWITCH (SW1)",
        hostname: "SW1",
        commands: [
          "enable",
          "configure terminal",
          "vlan 10",
          "name Sales",
          "vlan 20",
          "name Engineering",
          "vlan 30",
          "name Management",
          "vlan 99",
          "exit",
          "interface GigabitEthernet0/1",
          "switchport mode access",
          "switchport access vlan 10",
          "no shutdown",
          "interface GigabitEthernet0/2",
          "switchport mode access",
          "switchport access vlan 20",
          "no shutdown",
          "interface GigabitEthernet0/3",
          "switchport mode access",
          "switchport access vlan 30",
          "no shutdown",
          "interface GigabitEthernet0/24",
          "switchport trunk encapsulation dot1q",
          "switchport mode trunk",
          "switchport trunk native vlan 99",
          "switchport trunk allowed vlan 10,20,30,99",
          "no shutdown",
          "end",
        ],
      },
      {
        marker: "ROUTER (R1)",
        hostname: "R1",
        commands: [
          "enable",
          "configure terminal",
          "interface GigabitEthernet0/0",
          "no ip address",
          "no shutdown",
          "interface GigabitEthernet0/0.10",
          "encapsulation dot1Q 10",
          "ip address 192.168.10.1 255.255.255.0",
          "interface GigabitEthernet0/0.20",
          "encapsulation dot1Q 20",
          "ip address 192.168.20.1 255.255.255.0",
          "interface GigabitEthernet0/0.30",
          "encapsulation dot1Q 30",
          "ip address 192.168.30.1 255.255.255.0",
          "end",
        ],
      },
    ],
  },
  {
    slug: "static-routing",
    title: "IPv4 and IPv6 Static Routing",
    multiDevice: true,
    devices: [
      {
        marker: "ROUTER R1",
        hostname: "R1",
        commands: [
          "enable",
          "configure terminal",
          "ip route 10.2.2.0 255.255.255.0 10.0.0.2",
          "ip route 0.0.0.0 0.0.0.0 10.0.0.2",
          "ip route 0.0.0.0 0.0.0.0 10.0.0.6 210",
          "end",
        ],
      },
      {
        marker: "ROUTER R2",
        hostname: "R2",
        commands: [
          "enable",
          "configure terminal",
          "ip route 10.1.1.0 255.255.255.0 10.0.0.1",
          "ip route 0.0.0.0 0.0.0.0 203.0.113.2",
          "end",
        ],
      },
    ],
  },
  {
    slug: "ospf-config",
    title: "Single-Area OSPF Configuration",
    multiDevice: false,
    devices: [
      {
        hostname: "Router",
        commands: [
          "enable",
          "configure terminal",
          "router ospf 1",
          "router-id 1.1.1.1",
          "network 192.168.1.0 0.0.0.255 area 0",
          "network 10.0.0.0 0.0.0.255 area 0",
          "passive-interface GigabitEthernet0/2",
          "exit",
          "interface GigabitEthernet0/0",
          "ip ospf network point-to-point",
          "exit",
          "end",
        ],
      },
    ],
  },
  {
    slug: "nat-config",
    title: "NAT and PAT Configuration",
    multiDevice: false,
    devices: [
      {
        hostname: "Router",
        commands: [
          "enable",
          "configure terminal",
          "ip nat inside source static 10.0.0.100 203.0.113.10",
          "access-list 1 permit 10.0.0.0 0.0.0.255",
          "ip nat inside source list 1 interface GigabitEthernet0/1 overload",
          "interface GigabitEthernet0/0",
          "ip nat inside",
          "interface GigabitEthernet0/1",
          "ip nat outside",
          "end",
        ],
      },
    ],
  },
  {
    slug: "ssh-config",
    title: "Secure Device Management with SSH",
    multiDevice: false,
    devices: [
      {
        hostname: "Router",
        commands: [
          "enable",
          "configure terminal",
          "hostname R1",
          "ip domain-name ccnastudy.lab",
          "crypto key generate rsa modulus 2048",
          "ip ssh version 2",
          "username admin privilege 15 secret Cisco123!",
          "line vty 0 4",
          "login local",
          "transport input ssh",
          "exec-timeout 10 0",
          "exit",
          "line console 0",
          "password ConPass1!",
          "login",
          "exit",
          "enable secret EnablePass1!",
          "service password-encryption",
          "end",
        ],
      },
    ],
  },
  {
    slug: "acl-config",
    title: "Standard and Extended ACL Configuration",
    multiDevice: false,
    devices: [
      {
        hostname: "Router",
        commands: [
          "enable",
          "configure terminal",
          "ip access-list extended SALES-POLICY",
          "permit tcp 10.1.10.0 0.0.0.255 host 10.1.50.10 eq 80",
          "permit tcp 10.1.10.0 0.0.0.255 host 10.1.50.10 eq 443",
          "deny tcp 10.1.10.0 0.0.0.255 host 10.1.50.20 eq 22",
          "permit icmp 10.1.10.0 0.0.0.255 10.1.50.0 0.0.0.255",
          "deny ip 10.1.10.0 0.0.0.255 10.1.50.0 0.0.0.255 log",
          "permit ip any any",
          "exit",
          "interface GigabitEthernet0/0",
          "ip access-group SALES-POLICY in",
          "exit",
          "ip access-list standard VTY-ACCESS",
          "permit host 10.1.20.5",
          "exit",
          "line vty 0 4",
          "access-class VTY-ACCESS in",
          "exit",
          "end",
        ],
      },
    ],
  },
  {
    slug: "etherchannel-config",
    title: "EtherChannel with LACP",
    multiDevice: true,
    devices: [
      {
        marker: "SWITCH SW1",
        hostname: "SW1",
        commands: [
          "enable",
          "configure terminal",
          "interface range GigabitEthernet0/1-2",
          "channel-group 1 mode active",
          "no shutdown",
          "interface Port-channel1",
          "switchport trunk encapsulation dot1q",
          "switchport mode trunk",
          "switchport trunk native vlan 99",
          "switchport trunk allowed vlan 10,20,30,99",
          "no shutdown",
          "end",
        ],
      },
      {
        marker: "SWITCH SW2",
        hostname: "SW2",
        commands: [
          "enable",
          "configure terminal",
          "interface range GigabitEthernet0/1-2",
          "channel-group 1 mode passive",
          "no shutdown",
          "interface Port-channel1",
          "switchport trunk encapsulation dot1q",
          "switchport mode trunk",
          "switchport trunk native vlan 99",
          "switchport trunk allowed vlan 10,20,30,99",
          "no shutdown",
          "end",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// IOS lab shorthand variants — same solutions but abbreviated
// ---------------------------------------------------------------------------

const SHORTHAND_LABS: typeof IOS_LABS = IOS_LABS.map((lab) => ({
  ...lab,
  devices: lab.devices.map((dev) => ({
    ...dev,
    commands: toShorthand(dev.commands),
  })),
}));

// ══════════════════════════════════════════════════════════════════════════════
// TEST: Each IOS lab can be completed with full commands
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Lab Completion — Full Commands", () => {
  for (const lab of IOS_LABS) {
    test(`${lab.slug} — scores 100% with solution commands`, async ({
      page,
    }) => {
      await page.goto(`/dashboard/labs/${lab.slug}`);
      await page.waitForLoadState("networkidle");

      // Wait for terminal to be ready
      await expect(page.getByText("IOS CLI").first()).toBeVisible({
        timeout: 15000,
      });

      if (lab.multiDevice && lab.devices.length > 1) {
        // Multi-device: type commands on first device, switch, type on second
        for (let i = 0; i < lab.devices.length; i++) {
          if (i > 0) {
            // Click the device switcher button matching the hostname
            const hostname = lab.devices[i].hostname;
            const deviceBtn = page.locator(
              `button:has-text("${hostname}")`
            ).first();
            await expect(deviceBtn).toBeVisible({ timeout: 5000 });
            await deviceBtn.click();
            await page.waitForTimeout(300);
          }
          await typeIOSCommands(page, lab.devices[i].commands);
        }
      } else {
        await typeIOSCommands(page, lab.devices[0].commands);
      }

      // Click Check Solution
      const checkBtn = page.getByRole("button", { name: /Check Solution/i });
      await expect(checkBtn).toBeEnabled();
      await checkBtn.click();

      // Wait for validation result
      await expect(page.getByText("Score").first()).toBeVisible({
        timeout: 10000,
      });

      // Verify 100% score
      await expect(page.getByText("100%").first()).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.getByText(/All.*commands.*present|All devices configured/i).first()
      ).toBeVisible();
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST: Each IOS lab can be completed with shorthand commands
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Lab Completion — Shorthand Commands", () => {
  for (const lab of SHORTHAND_LABS) {
    test(`${lab.slug} — scores 100% with shorthand commands`, async ({
      page,
    }) => {
      await page.goto(`/dashboard/labs/${lab.slug}`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("IOS CLI").first()).toBeVisible({
        timeout: 15000,
      });

      if (lab.multiDevice && lab.devices.length > 1) {
        for (let i = 0; i < lab.devices.length; i++) {
          if (i > 0) {
            const hostname = lab.devices[i].hostname;
            const deviceBtn = page.locator(
              `button:has-text("${hostname}")`
            ).first();
            await expect(deviceBtn).toBeVisible({ timeout: 5000 });
            await deviceBtn.click();
            await page.waitForTimeout(300);
          }
          await typeIOSCommands(page, lab.devices[i].commands);
        }
      } else {
        await typeIOSCommands(page, lab.devices[0].commands);
      }

      const checkBtn = page.getByRole("button", { name: /Check Solution/i });
      await expect(checkBtn).toBeEnabled();
      await checkBtn.click();

      await expect(page.getByText("Score").first()).toBeVisible({
        timeout: 10000,
      });

      // Verify 100% — shorthand must expand to match full solution
      await expect(page.getByText("100%").first()).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.getByText(/All.*commands.*present|All devices configured/i).first()
      ).toBeVisible();
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST: Subnetting lab can be completed
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Lab Completion — Subnetting", () => {
  test("subnetting-ipv4 — submits correct answers", async ({ page }) => {
    await page.goto("/dashboard/labs/subnetting-ipv4");
    await page.waitForLoadState("networkidle");

    // Wait for CodeMirror editor
    const editor = page.locator(".cm-editor").first();
    await expect(editor).toBeVisible({ timeout: 15000 });

    const solution = [
      "subnet_mask=255.255.255.192",
      "cidr=/26",
      "network=192.168.10.0",
      "broadcast=192.168.10.63",
      "first_host=192.168.10.1",
      "last_host=192.168.10.62",
      "usable_hosts=62",
    ].join("\n");

    // Click into editor and type the solution
    const cmContent = page.locator(".cm-content").first();
    await cmContent.click();
    await cmContent.fill(solution);

    // Click Run Code
    const runBtn = page.getByRole("button", { name: /Run Code/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // Verify execution succeeded
    await expect(
      page.getByText(/Execution successful|submitted/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

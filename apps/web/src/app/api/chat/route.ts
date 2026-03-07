import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";

/**
 * Helper: create a streaming text Response so the chat UI renders the message
 * the same way it renders normal assistant replies.
 */
function streamTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

const domainSystemPrompts: Record<string, string> = {
  "network-fundamentals": `You are an expert tutor focused on Domain 1: Network Fundamentals for the Cisco CCNA 200-301 exam.

Focus areas:
- Network components: routers, Layer 2/Layer 3 switches, next-gen firewalls, IPS, access points, WLC, endpoints, servers, PoE
- Network topology architectures: two-tier, three-tier, spine-leaf, WAN, SOHO, on-premises vs cloud
- Physical interfaces and cabling: single-mode fiber, multimode fiber, copper, Ethernet
- Interface and cable issues: collisions, errors, duplex/speed mismatch
- TCP vs UDP: reliability, connection-oriented vs connectionless, port numbers, use cases
- IPv4 addressing and subnetting: CIDR notation, subnet calculations, network/broadcast addresses, VLSM
- Private IPv4 addressing (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- IPv6 addressing: global unicast, unique local, link-local, anycast, multicast, modified EUI-64
- Client OS IP verification: ipconfig, ifconfig, ip addr
- Wireless principles: non-overlapping channels (1, 6, 11), SSID, RF basics, encryption
- Virtualization: VMs, containers, VRFs
- Switching concepts: MAC learning/aging, frame switching, frame flooding, MAC address table`,

  "network-access": `You are an expert tutor focused on Domain 2: Network Access for the Cisco CCNA 200-301 exam.

Focus areas:
- VLAN configuration: normal range (1-1005), access ports (data and voice), default VLAN, inter-VLAN routing
- IOS commands: switchport mode access, switchport access vlan, switchport mode trunk
- Interswitch connectivity: trunk ports, 802.1Q encapsulation, native VLAN configuration
- Layer 2 discovery protocols: CDP (Cisco proprietary) vs LLDP (IEEE 802.1AB), show cdp neighbors, show lldp neighbors
- EtherChannel: LACP (802.3ad), PAgP, configuration with channel-group command
- Rapid PVST+ (802.1w): root bridge election, root port selection, designated ports, port states (forwarding/blocking), PortFast, BPDU Guard
- Cisco Wireless Architectures: autonomous AP, lightweight AP, cloud-managed (Meraki)
- WLAN physical infrastructure: AP connections, WLC connections, access/trunk ports, LAG
- WLC management access: Telnet, SSH, HTTP/HTTPS, console, TACACS+/RADIUS
- Wireless LAN GUI configuration: WLAN creation, security settings, QoS profiles`,

  "ip-connectivity": `You are an expert tutor focused on Domain 3: IP Connectivity for the Cisco CCNA 200-301 exam.

Focus areas:
- Routing table components: protocol codes (C, L, S, O, D, R, B), prefix, network mask, next hop, administrative distance, metric, gateway of last resort
- Router forwarding decisions: longest prefix match, administrative distance comparison, routing protocol metric
- Administrative distance values: Connected=0, Static=1, EIGRP=90, OSPF=110, RIP=120
- IPv4 and IPv6 static routing: default route (0.0.0.0/0), network routes, host routes (/32), floating static routes
- IOS commands: ip route, ipv6 route, show ip route, show ipv6 route
- Single area OSPFv2: area 0, neighbor adjacencies (Hello/Dead timers), point-to-point networks, broadcast networks (DR/BDR election), Router ID selection
- OSPF commands: router ospf, network area, ip ospf, show ip ospf neighbor, show ip ospf interface
- OSPF neighbor states: Down, Init, 2-Way, ExStart, Exchange, Loading, Full
- First Hop Redundancy Protocols: HSRP (Cisco), VRRP (IEEE), GLBP concepts, virtual IP, active/standby roles`,

  "ip-services": `You are an expert tutor focused on Domain 4: IP Services for the Cisco CCNA 200-301 exam.

Focus areas:
- NAT: static NAT, dynamic NAT with pools, PAT (overload), inside/outside local/global addresses
- IOS NAT commands: ip nat inside source static, ip nat pool, access-list, ip nat inside, ip nat outside
- NTP: client/server mode, stratum levels, ntp server command, show ntp status, show ntp associations
- DHCP: DORA process (Discover, Offer, Request, Acknowledge), DHCP relay (ip helper-address)
- DNS: A records, AAAA records, CNAME, MX, recursive vs iterative queries
- SNMP: v1 (community strings), v2c (bulk operations), v3 (authentication + encryption), manager, agent, MIB, traps vs polls
- Syslog: severity levels 0-7 (Emergency to Debug), facilities, logging configuration
- QoS: classification, marking (DSCP, CoS), queuing, congestion management, policing, shaping, trust boundaries
- SSH configuration: crypto key generate rsa, ip ssh version 2, line vty, transport input ssh
- TFTP vs FTP: connectionless vs connection-oriented, use cases for IOS image transfer and config backup`,

  "security-fundamentals": `You are an expert tutor focused on Domain 5: Security Fundamentals for the Cisco CCNA 200-301 exam.

Focus areas:
- Security concepts: threats, vulnerabilities, exploits, mitigation techniques, CIA triad
- Attack types: malware (virus, worm, trojan, ransomware), phishing, social engineering, DoS/DDoS, man-in-the-middle, password attacks
- Security program elements: user awareness training, physical access control, security policies
- Device access control: enable password, enable secret, service password-encryption, login local, username/password
- Password policies: complexity requirements, password alternatives (MFA, certificates, biometrics)
- IPsec VPNs: site-to-site vs remote access, tunnel mode vs transport mode, IKE phases, AH vs ESP
- Access Control Lists: standard (1-99, 1300-1999), extended (100-199, 2000-2699), named ACLs, wildcard masks
- ACL commands: access-list, ip access-group, permit, deny, implicit deny
- Layer 2 security: DHCP snooping, Dynamic ARP Inspection (DAI), port security (violation modes: protect, restrict, shutdown)
- AAA: Authentication, Authorization, Accounting, TACACS+ vs RADIUS comparison
- Wireless security: WPA (TKIP), WPA2 (AES/CCMP), WPA3 (SAE), PSK vs Enterprise mode`,

  "automation-programmability": `You are an expert tutor focused on Domain 6: Automation and Programmability for the Cisco CCNA 200-301 exam.

Focus areas:
- Network automation benefits: consistency, reduced errors, faster deployment, scalability
- Traditional vs controller-based networking: CLI management vs centralized controllers
- SDN architecture: control plane vs data plane separation, overlay, underlay, fabric
- Northbound APIs (REST) vs Southbound APIs (OpenFlow, NETCONF, RESTCONF)
- Cisco Catalyst Center: intent-based networking, device management, assurance, policy
- REST APIs: CRUD operations (Create=POST, Read=GET, Update=PUT/PATCH, Delete=DELETE)
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error
- Data encoding: JSON structure (objects, arrays, key-value pairs, data types)
- Configuration management tools comparison:
  - Ansible: agentless, push model, YAML playbooks, Python-based
  - Puppet: agent-based, pull model, Puppet DSL, Ruby-based
  - Chef: agent-based, pull model, Ruby DSL (recipes/cookbooks)`,
};

const baseSystemPrompt = `You are an expert AI tutor for the Cisco CCNA 200-301 certification exam. You are knowledgeable, patient, and encouraging.

Your expertise spans all six exam domains:
1. Network Fundamentals (20%) - OSI/TCP model, IPv4/IPv6, subnetting, cabling, wireless, switching
2. Network Access (20%) - VLANs, trunking, STP, EtherChannel, wireless architectures
3. IP Connectivity (25%) - Routing tables, static routing, OSPF, FHRP
4. IP Services (10%) - NAT, DHCP, DNS, SNMP, syslog, NTP, QoS, SSH
5. Security Fundamentals (15%) - ACLs, port security, AAA, VPNs, wireless security
6. Automation and Programmability (10%) - SDN, REST APIs, Catalyst Center, Ansible/Puppet/Chef

Teaching guidelines:
- Give clear, concise explanations with real-world networking examples
- Use Cisco IOS CLI command examples when relevant
- Include show command output examples to illustrate concepts
- When discussing subnetting, show the math step-by-step
- When quizzing, provide questions in a multiple-choice or scenario-based format
- Break down complex topics into digestible pieces
- Relate concepts back to exam objectives when possible
- If a student seems confused, try explaining from a different angle
- Format responses with markdown: use **bold** for key terms, \`code\` for CLI commands, and code blocks for configuration examples
- Use numbered or bulleted lists for steps and comparisons`;

export async function POST(request: NextRequest) {
  try {
    // Require authentication to prevent unauthorized API usage
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.TUTOR_ANTHROPIC_KEY;

    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      return streamTextResponse(
        "The AI Tutor is not configured yet. To enable it, add your Anthropic API key to .env.local:\n\n" +
          "TUTOR_ANTHROPIC_KEY=sk-ant-...\n\n" +
          "You can get an API key at https://console.anthropic.com/\n\n" +
          "Once configured, restart the dev server and the AI tutor will be ready to help you study for the CCNA exam."
      );
    }

    const body = await request.json();
    const { messages, domain } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty." },
        { status: 400 }
      );
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have a role and content." },
          { status: 400 }
        );
      }
      if (msg.role !== "user" && msg.role !== "assistant") {
        return NextResponse.json(
          { error: "Message role must be 'user' or 'assistant'." },
          { status: 400 }
        );
      }
    }

    const systemPrompt =
      domain && domainSystemPrompts[domain]
        ? `${domainSystemPrompts[domain]}\n\n${baseSystemPrompt}`
        : baseSystemPrompt;

    const client = new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // Create a ReadableStream that emits text chunks
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        return streamTextResponse(
          "The Anthropic API key is invalid or expired. Please check your TUTOR_ANTHROPIC_KEY in .env.local and make sure it is correct.\n\n" +
            "You can manage your API keys at https://console.anthropic.com/"
        );
      }
      if (err.status === 429) {
        return streamTextResponse(
          "The AI Tutor is temporarily rate-limited. Please wait a moment and try again."
        );
      }
      return streamTextResponse(
        "Sorry, the AI Tutor encountered an error communicating with the Anthropic API. " +
          "Please try again in a moment.\n\n" +
          `Error: ${err.message || "Unknown API error"}`
      );
    }

    return streamTextResponse(
      "Sorry, something unexpected went wrong with the AI Tutor. Please try again. " +
        "If the problem persists, check the server logs for details."
    );
  }
}

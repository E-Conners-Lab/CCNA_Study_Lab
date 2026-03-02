"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CCNA_DOMAINS } from "@/lib/domains";

interface Objective {
  id: string;
  title: string;
  labSlug?: string;
}

interface StudyDomain {
  number: number;
  name: string;
  slug: string;
  weight: number;
  objectives: Objective[];
}

/** Exam objectives per domain (content that doesn't live in the canonical domains list) */
const DOMAIN_OBJECTIVES: Record<number, Objective[]> = {
  1: [
    { id: "1.1", title: "Explain the role and function of network components (routers, L2/L3 switches, firewalls, IPS, APs, controllers, endpoints, servers, PoE)" },
    { id: "1.2", title: "Describe characteristics of network topology architectures (two-tier, three-tier, spine-leaf, WAN, SOHO, on-premises and cloud)" },
    { id: "1.3", title: "Compare physical interface and cabling types (single-mode fiber, multimode fiber, copper, Ethernet shared media and point-to-point)" },
    { id: "1.4", title: "Identify interface and cable issues (collisions, errors, mismatch duplex, and/or speed)" },
    { id: "1.5", title: "Compare TCP to UDP" },
    { id: "1.6", title: "Configure and verify IPv4 addressing and subnetting", labSlug: "subnetting-ipv4" },
    { id: "1.7", title: "Describe the need for private IPv4 addressing" },
    { id: "1.8", title: "Configure and verify IPv6 addressing and prefix" },
    { id: "1.9", title: "Describe IPv6 address types (unicast, anycast, multicast, modified EUI-64)" },
    { id: "1.10", title: "Verify IP parameters for Client OS (Windows, Mac OS, Linux)" },
    { id: "1.11", title: "Describe wireless principles (nonoverlapping Wi-Fi channels, SSID, RF, encryption)" },
    { id: "1.12", title: "Explain virtualization fundamentals (server virtualization, containers, and VRFs)" },
    { id: "1.13", title: "Describe switching concepts (MAC learning and aging, frame switching, frame flooding, MAC address table)" },
  ],
  2: [
    { id: "2.1", title: "Configure and verify VLANs (normal range) spanning multiple switches", labSlug: "vlan-config" },
    { id: "2.2", title: "Configure and verify interswitch connectivity (trunk ports, 802.1Q, native VLAN)", labSlug: "vlan-config" },
    { id: "2.3", title: "Configure and verify Layer 2 discovery protocols (CDP and LLDP)" },
    { id: "2.4", title: "Configure and verify (Layer 2/Layer 3) EtherChannel (LACP)" },
    { id: "2.5", title: "Interpret the Rapid PVST+ Spanning Tree Protocol (root port, root bridge, port states, PortFast)" },
    { id: "2.6", title: "Describe Cisco Wireless Architectures and AP modes" },
    { id: "2.7", title: "Describe physical infrastructure connections of WLAN components (AP, WLC, access/trunk ports, LAG)" },
    { id: "2.8", title: "Describe AP and WLC management access connections (Telnet, SSH, HTTP, HTTPS, console, TACACS+/RADIUS)" },
    { id: "2.9", title: "Interpret the wireless LAN GUI configuration for client connectivity" },
  ],
  3: [
    { id: "3.1", title: "Interpret the components of routing table (protocol code, prefix, mask, next hop, AD, metric, gateway of last resort)" },
    { id: "3.2", title: "Determine how a router makes a forwarding decision by default (longest prefix match, AD, metric)" },
    { id: "3.3", title: "Configure and verify IPv4 and IPv6 static routing (default, network, host, floating static)", labSlug: "static-routing" },
    { id: "3.4", title: "Configure and verify single area OSPFv2 (neighbor adjacencies, point-to-point, broadcast DR/BDR, router ID)", labSlug: "ospf-config" },
    { id: "3.5", title: "Describe the purpose, functions, and concepts of first hop redundancy protocols" },
  ],
  4: [
    { id: "4.1", title: "Configure and verify inside source NAT using static and pools", labSlug: "nat-config" },
    { id: "4.2", title: "Configure and verify NTP operating in a client and server mode" },
    { id: "4.3", title: "Explain the role of DHCP and DNS within the network" },
    { id: "4.4", title: "Explain the function of SNMP in network operations" },
    { id: "4.5", title: "Describe the use of syslog features including facilities and levels" },
    { id: "4.6", title: "Configure and verify DHCP client and relay" },
    { id: "4.7", title: "Explain the forwarding per-hop behavior (PHB) for QoS (classification, marking, queuing, congestion, policing, shaping)" },
    { id: "4.8", title: "Configure network devices for remote access using SSH", labSlug: "ssh-config" },
    { id: "4.9", title: "Describe the capabilities and functions of TFTP/FTP in the network" },
  ],
  5: [
    { id: "5.1", title: "Define key security concepts (threats, vulnerabilities, exploits, and mitigation techniques)" },
    { id: "5.2", title: "Describe security program elements (user awareness, training, and physical access control)" },
    { id: "5.3", title: "Configure and verify device access control using local passwords", labSlug: "device-security" },
    { id: "5.4", title: "Describe security password policies elements (management, complexity, MFA, certificates, biometrics)" },
    { id: "5.5", title: "Describe IPsec remote access and site-to-site VPNs" },
    { id: "5.6", title: "Configure and verify access control lists", labSlug: "acl-config" },
    { id: "5.7", title: "Configure and verify Layer 2 security features (DHCP snooping, dynamic ARP inspection, port security)" },
    { id: "5.8", title: "Compare authentication, authorization, and accounting concepts" },
    { id: "5.9", title: "Describe wireless security protocols (WPA, WPA2, and WPA3)" },
    { id: "5.10", title: "Configure and verify WLAN within the GUI using WPA2 PSK" },
  ],
  6: [
    { id: "6.1", title: "Explain how automation impacts network management" },
    { id: "6.2", title: "Compare traditional networks with controller-based networking" },
    { id: "6.3", title: "Describe controller-based, software defined architecture (overlay, underlay, fabric)" },
    { id: "6.4", title: "Compare traditional campus device management with Cisco Catalyst Center enabled device management" },
    { id: "6.5", title: "Describe characteristics of REST-based APIs (CRUD, HTTP verbs, and data encoding)" },
    { id: "6.6", title: "Recognize the capabilities of configuration management mechanisms Puppet, Chef, and Ansible" },
    { id: "6.7", title: "Recognize components of JSON-encoded data" },
  ],
};

/** Build study domains from canonical CCNA_DOMAINS + per-domain objectives */
const studyDomains: StudyDomain[] = CCNA_DOMAINS.map((d) => ({
  number: d.number,
  name: d.name,
  slug: d.slug,
  weight: d.weight,
  objectives: DOMAIN_OBJECTIVES[d.number] ?? [],
}));

export default function StudyPage() {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set()
  );
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(
    new Set()
  );

  // Load study progress from API (DB wins over hardcoded defaults)
  useEffect(() => {
    fetch("/api/study/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.completed && data.completed.length > 0) {
          setCompletedObjectives(new Set(data.completed));
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  const toggleDomain = (slug: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleObjective = (id: string) => {
    const willComplete = !completedObjectives.has(id);
    setCompletedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // Fire-and-forget: persist to DB via API
    fetch("/api/study/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveCode: id, completed: willComplete }),
    }).catch(() => {
      // API unavailable — state change is still reflected in UI
    });
  };

  const totalObjectives = studyDomains.reduce(
    (acc, d) => acc + d.objectives.length,
    0
  );
  const totalCompleted = completedObjectives.size;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Study Hub
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Work through all exam objectives organized by domain
        </p>
      </div>

      {/* Overall Stats */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">Overall Completion</p>
              <p className="text-2xl font-bold text-zinc-100">
                {totalCompleted}{" "}
                <span className="text-base font-normal text-zinc-500">
                  / {totalObjectives} objectives
                </span>
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Progress
                value={(totalCompleted / totalObjectives) * 100}
                className="h-2 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-blue-500"
              />
              <p className="text-xs text-zinc-500 mt-1 text-right">
                {Math.round((totalCompleted / totalObjectives) * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Cards */}
      <div className="space-y-4">
        {studyDomains.map((domain) => {
          const isExpanded = expandedDomains.has(domain.slug);
          const domainCompleted = domain.objectives.filter((o) =>
            completedObjectives.has(o.id)
          ).length;
          const domainProgress = Math.round(
            (domainCompleted / domain.objectives.length) * 100
          );

          return (
            <Card
              key={domain.slug}
              className="border-zinc-800 bg-zinc-900/50 overflow-hidden"
            >
              {/* Domain header - clickable */}
              <button
                onClick={() => toggleDomain(domain.slug)}
                className="w-full text-left"
              >
                <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-sm font-bold text-blue-500 shrink-0">
                      {domain.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold text-zinc-200">
                          {domain.name}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px]"
                        >
                          {domain.weight}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Progress
                          value={domainProgress}
                          className="h-1.5 flex-1 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-blue-500"
                        />
                        <span className="text-xs text-zinc-500 shrink-0">
                          {domainCompleted}/{domain.objectives.length}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-zinc-500">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Objectives list */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="bg-zinc-800 mb-4" />
                  <div className="space-y-1">
                    {domain.objectives.map((objective) => {
                      const isCompleted = completedObjectives.has(objective.id);
                      return (
                        <div
                          key={objective.id}
                          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-800/30 transition-colors group"
                        >
                          <button
                            onClick={() => toggleObjective(objective.id)}
                            className="mt-0.5 shrink-0"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-blue-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/study/${domain.slug}`}
                              className={cn(
                                "text-sm leading-relaxed block rounded px-1 -mx-1 hover:bg-zinc-800/50 transition-colors",
                                isCompleted
                                  ? "text-zinc-500 line-through"
                                  : "text-zinc-300 hover:text-blue-400"
                              )}
                            >
                              <span className="font-mono text-xs text-blue-500/70 mr-2">
                                {objective.id}
                              </span>
                              {objective.title}
                            </Link>
                          </div>
                          {objective.labSlug && (
                            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link href="/dashboard/labs">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-zinc-500 hover:text-blue-400"
                                >
                                  <FlaskConical className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

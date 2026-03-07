import { Contact, LinkPrecedence } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface IdentifyResult {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

export async function identifyContact(
  email: string | null | undefined,
  phoneNumber: string | null | undefined
): Promise<IdentifyResult> {
  const normalizedEmail = email?.trim() || null;
  const normalizedPhone = phoneNumber?.toString().trim() || null;

  // Step 1: Find all contacts matching email OR phone
  const directMatches = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
      ],
    },
  });

  // Step 2: No matches → create new primary contact
  if (directMatches.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkPrecedence: LinkPrecedence.primary,
        linkedId: null,
      },
    });

    return buildResponse(newContact, []);
  }

  // Step 3: Find all unique root primary IDs from matched contacts
  const primaryIds = new Set<number>();
  for (const contact of directMatches) {
    if (contact.linkPrecedence === LinkPrecedence.primary) {
      primaryIds.add(contact.id);
    } else if (contact.linkedId !== null) {
      primaryIds.add(contact.linkedId);
    }
  }

  // Step 4: Fetch the full clusters for all found primaries
  let allClusterContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: { in: Array.from(primaryIds) } },
        { linkedId: { in: Array.from(primaryIds) } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Step 5: If multiple primaries, merge — oldest stays primary
  const primaries = allClusterContacts.filter(
    (c) => c.linkPrecedence === LinkPrecedence.primary
  );

  if (primaries.length > 1) {
    // Oldest (first created) remains the one true primary
    const [oldestPrimary, ...demotedPrimaries] = primaries;

    for (const demoted of demotedPrimaries) {
      // Demote this primary to secondary
      await prisma.contact.update({
        where: { id: demoted.id },
        data: {
          linkedId: oldestPrimary.id,
          linkPrecedence: LinkPrecedence.secondary,
          updatedAt: new Date(),
        },
      });

      // Re-point all of this demoted primary's secondaries to the oldest primary
      await prisma.contact.updateMany({
        where: {
          linkedId: demoted.id,
          deletedAt: null,
        },
        data: {
          linkedId: oldestPrimary.id,
          updatedAt: new Date(),
        },
      });
    }

    // Re-fetch full cluster after merge
    allClusterContacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: oldestPrimary.id },
          { linkedId: oldestPrimary.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // Step 6: Check if the incoming request contains new information
  const primary = allClusterContacts.find(
    (c) => c.linkPrecedence === LinkPrecedence.primary
  )!;

  const existingEmails = new Set(
    allClusterContacts.map((c) => c.email).filter(Boolean)
  );
  const existingPhones = new Set(
    allClusterContacts.map((c) => c.phoneNumber).filter(Boolean)
  );

  const isNewEmail = normalizedEmail && !existingEmails.has(normalizedEmail);
  const isNewPhone = normalizedPhone && !existingPhones.has(normalizedPhone);

  if (isNewEmail || isNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkedId: primary.id,
        linkPrecedence: LinkPrecedence.secondary,
      },
    });
    allClusterContacts.push(newSecondary);
  }

  // Step 7: Build and return the consolidated response
  const secondaries = allClusterContacts.filter(
    (c) => c.linkPrecedence === LinkPrecedence.secondary
  );

  return buildResponse(primary, secondaries);
}

function buildResponse(
  primary: Contact,
  secondaries: Contact[]
): IdentifyResult {
  // Deduplicated emails: primary's email first, then secondaries
  const emailSet = new Set<string>();
  if (primary.email) emailSet.add(primary.email);
  for (const s of secondaries) {
    if (s.email) emailSet.add(s.email);
  }

  // Deduplicated phones: primary's phone first, then secondaries
  const phoneSet = new Set<string>();
  if (primary.phoneNumber) phoneSet.add(primary.phoneNumber);
  for (const s of secondaries) {
    if (s.phoneNumber) phoneSet.add(s.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primary.id,
      emails: Array.from(emailSet),
      phoneNumbers: Array.from(phoneSet),
      secondaryContactIds: secondaries.map((s) => s.id),
    },
  };
}

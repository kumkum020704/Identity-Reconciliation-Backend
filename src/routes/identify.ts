import { Router, Request, Response } from "express";
import { identifyContact } from "../services/contactService";

const router = Router();

router.post("/identify", async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  // Validate: at least one field must be present and non-null
  const hasEmail = email !== null && email !== undefined && email !== "";
  const hasPhone =
    phoneNumber !== null && phoneNumber !== undefined && phoneNumber !== "";

  if (!hasEmail && !hasPhone) {
    res.status(400).json({
      error: "At least one of 'email' or 'phoneNumber' must be provided.",
    });
    return;
  }

  try {
    const result = await identifyContact(
      hasEmail ? String(email) : null,
      hasPhone ? String(phoneNumber) : null
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /identify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

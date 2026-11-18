import type { Metadata } from "next";
import AboutPage from "./about/page";

export const metadata: Metadata = {
  title: "Shadow Standup",
  description: "Standups and code reviews generated from your GitHub activity.",
};

// About is the default page: it is what opens at "/".
export default AboutPage;

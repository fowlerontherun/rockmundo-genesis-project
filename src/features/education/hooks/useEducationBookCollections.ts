import { useMemo } from "react";

import type { BookCollection } from "../types";

export const useEducationBookCollections = (): BookCollection[] => {
  return useMemo(
    () => [
      {
        title: "Foundational Musicianship",
        description:
          "Master the essentials of music theory, ear training, and instrument technique to build confident performance skills.",
        items: [
          {
            name: "The Musician's Handbook",
            author: "Bobby Borg",
            focus: "Career Fundamentals",
            takeaway:
              "Establish a rock-solid foundation for navigating the industry and building sustainable habits."
          },
          {
            name: "Music Theory for Guitarists",
            author: "Tom Kolb",
            focus: "Theory Essentials",
            takeaway: "Translate theory concepts directly onto the fretboard with modern practice drills."
          },
          {
            name: "Effortless Mastery",
            author: "Kenny Werner",
            focus: "Mindset & Practice",
            takeaway: "Unlock flow-state practicing with techniques that balance discipline and creativity."
          }
        ]
      },
      {
        title: "Songwriting & Creativity",
        description:
          "Upgrade your writing toolkit with books that unpack lyricism, storytelling, and arranging for modern audiences.",
        items: [
          {
            name: "Writing Better Lyrics",
            author: "Pat Pattison",
            focus: "Lyric Craft",
            takeaway: "A semester-style guide to turning song ideas into compelling narratives."
          },
          {
            name: "Tunesmith",
            author: "Jimmy Webb",
            focus: "Composition",
            takeaway:
              "Legendary songwriting lessons from a Grammy-winning composer with exercises you can apply immediately."
          },
          {
            name: "Songwriters On Songwriting",
            author: "Paul Zollo",
            focus: "Creative Process",
            takeaway:
              "Dozens of interviews with iconic writers that reveal breakthrough moments and creative systems."
          }
        ]
      },
      {
        title: "Music Business & Branding",
        description:
          "Navigate the modern music economy with guides that demystify contracts, marketing, and independent releases.",
        items: [
          {
            name: "All You Need to Know About the Music Business",
            author: "Donald Passman",
            focus: "Industry",
            takeaway:
              "Understand contracts, royalties, and negotiation tactics before your next big opportunity."
          },
          {
            name: "Creative Quest",
            author: "Questlove",
            focus: "Creative Leadership",
            takeaway:
              "Blend artistry and entrepreneurship through stories from one of music's most inventive minds."
          },
          {
            name: "How to Make It in the New Music Business",
            author: "Ari Herstand",
            focus: "Indie Strategy",
            takeaway:
              "A modern blueprint for self-managed releases, touring, and audience growth."
          }
        ]
      }
    ],
    []
  );
};

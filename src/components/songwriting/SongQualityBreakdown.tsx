import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { getSongRating } from "@/data/songRatings";
import type { SongQualityResult } from "@/utils/songQuality";

interface SongQualityBreakdownProps {
  quality: SongQualityResult;
}

export const SongQualityBreakdown = ({ quality }: SongQualityBreakdownProps) => {
  const rating = getSongRating(quality.totalQuality);
  
  const areas = [
    { name: "Melody", value: quality.melodyStrength, max: 200 },
    { name: "Lyrics", value: quality.lyricsStrength, max: 200 },
    { name: "Rhythm", value: quality.rhythmStrength, max: 200 },
    { name: "Arrangement", value: quality.arrangementStrength, max: 200 },
    { name: "Production", value: quality.productionPotential, max: 200 },
  ];

  return (
    <Card className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="text-6xl">{rating.emoji}</div>
        <h3 className="text-2xl font-bold">{rating.label}</h3>
        <p className="text-muted-foreground">{rating.description}</p>
        <div className="text-4xl font-bold text-primary">
          {quality.totalQuality}
          <span className="text-lg text-muted-foreground">/1000</span>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Quality Breakdown</h4>
        {areas.map((area) => (
          <div key={area.name} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{area.name}</span>
              <span className="text-muted-foreground">
                {area.value}/{area.max}
              </span>
            </div>
            <Progress value={(area.value / area.max) * 100} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t text-sm">
        <span>Genre Familiarity Bonus</span>
        <span className="font-semibold">
          {((quality.genreMultiplier - 1) * 100).toFixed(0)}%
        </span>
      </div>

      {quality.skillCeiling < 1000 && (
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          💡 Skill ceiling: {quality.skillCeiling}/1000 - Train professional and mastery tier skills to unlock higher quality!
        </div>
      )}
    </Card>
  );
};

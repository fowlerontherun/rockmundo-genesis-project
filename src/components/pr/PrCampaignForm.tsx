import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type CampaignDraft = {
  campaign_type: string;
  campaign_name: string;
  budget: number;
  start_date: string;
  end_date: string;
};

interface PrCampaignFormProps {
  value: CampaignDraft;
  onChange: (next: CampaignDraft) => void;
  onSubmit: () => void;
  submitLabel?: string;
}

export const PrCampaignForm = ({ value, onChange, onSubmit, submitLabel = "Create Campaign" }: PrCampaignFormProps) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="campaign-name">Campaign Name</Label>
        <Input
          id="campaign-name"
          value={value.campaign_name}
          onChange={(e) => onChange({ ...value, campaign_name: e.target.value })}
          placeholder="Summer Media Blitz"
        />
      </div>
      <div>
        <Label htmlFor="campaign-type">Type</Label>
        <Select
          value={value.campaign_type}
          onValueChange={(next) => onChange({ ...value, campaign_type: next })}
        >
          <SelectTrigger id="campaign-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tv">TV</SelectItem>
            <SelectItem value="radio">Radio</SelectItem>
            <SelectItem value="podcast">Podcast</SelectItem>
            <SelectItem value="press">Press</SelectItem>
            <SelectItem value="social">Social Media</SelectItem>
            <SelectItem value="influencer">Influencer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="campaign-budget">Budget</Label>
        <Input
          id="campaign-budget"
          type="number"
          value={value.budget}
          onChange={(e) => onChange({ ...value, budget: Number(e.target.value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={value.start_date}
            onChange={(e) => onChange({ ...value, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="end-date">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={value.end_date}
            onChange={(e) => onChange({ ...value, end_date: e.target.value })}
          />
        </div>
      </div>
      <Button onClick={onSubmit} className="w-full">
        {submitLabel}
      </Button>
    </div>
  );
};

export default PrCampaignForm;

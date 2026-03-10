"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FiltersProps {
  segment: string;
  setSegment: (v: string) => void;
  destinationType: string;
  setDestinationType: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
}

function handleChange(setter: (v: string) => void) {
  return (value: string | null) => setter(value ?? "all");
}

export function Filters({
  segment,
  setSegment,
  destinationType,
  setDestinationType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={segment} onValueChange={handleChange(setSegment)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Segments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Segments</SelectItem>
          <SelectItem value="winter_birds">Winter Birds</SelectItem>
          <SelectItem value="holiday_travelers">Holiday Travelers</SelectItem>
          <SelectItem value="baseline">Baseline</SelectItem>
        </SelectContent>
      </Select>

      <Select value={destinationType} onValueChange={handleChange(setDestinationType)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Destination Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Destination Types</SelectItem>
          <SelectItem value="us_atlantic">US Atlantic</SelectItem>
          <SelectItem value="gulf_coast">Gulf Coast</SelectItem>
          <SelectItem value="caribbean">Caribbean</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
    </div>
  );
}

export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  media_urls?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CognitoUser {
  sub: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  username?: string | null;
  status?: string | null;
  enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_auth_time?: string | null;
  groups?: string[];
}

export interface Location {
  id: string;
  org_id: string;
  district: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Activity {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  age_min: number;
  age_max: number;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityPricing {
  id: string;
  activity_id: string;
  location_id: string;
  pricing_type: 'per_class' | 'per_month' | 'per_sessions';
  amount: string;
  currency: string;
  sessions_count?: number | null;
}

export interface ActivitySchedule {
  id: string;
  activity_id: string;
  location_id: string;
  schedule_type: 'weekly' | 'monthly' | 'date_specific';
  day_of_week_utc?: number | null;
  day_of_month?: number | null;
  start_minutes_utc?: number | null;
  end_minutes_utc?: number | null;
  start_at_utc?: string | null;
  end_at_utc?: string | null;
  languages: string[];
}

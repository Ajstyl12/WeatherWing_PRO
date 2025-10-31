
export interface WeatherData {
    city: string;
    country: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    pressure: number;
    condition: 'Clear' | 'Clouds' | 'Rain' | 'Snow' | 'Thunderstorm' | 'Drizzle' | 'Mist' | 'Haze' | string;
    description: string;
    latitude: number;
    longitude: number;
    localTime: string; // "HH:mm"
    // Optional timezone information to compute accurate local time (IANA timezone or UTC offset in minutes)
    timeZone?: string; // e.g. "Europe/London" (IANA)
    utcOffsetMinutes?: number; // offset from UTC in minutes, e.g. +60
}

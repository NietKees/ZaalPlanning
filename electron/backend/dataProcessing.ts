import type {LocationSchema} from "./schema";

export function getPrice(hours: number, location: LocationSchema): number {
    if (!location || hours <=0) return 0;

    let price = 0;

    if (hours <= (location.shortSessionHourCap ?? 3.5)){
        price = hours * (location.hourlyRate ?? 19.91);
    }
    else if(hours <= 4){
        price = (location.hourlyRate ?? 19.91) * 3.5;
    }
    else if(hours <= 8){
        price = location.flatSessionPrice ?? 130;
    }
    else if(hours > (location.fullSessionHourCap ?? 8)){
        price = (location.flatSessionPrice ?? 130) + (hours % 8) * (location.extendedHourlyRate ?? 12.50);
    }
    return Math.round(price * 100) / 100;
}

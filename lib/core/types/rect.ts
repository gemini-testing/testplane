import {Size} from "png-img/dist/types";

export interface Coordinate {
    top: number;
    left: number;
}

export interface SerializedRect extends Coordinate, Size {}

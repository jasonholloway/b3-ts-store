import { Observable, Subject } from "rxjs";
import { AnyUpdate, Model } from "./bits";
import { LogSpec } from "./LogSpace";

type Ref = string


type Frame = {
    spec: LogSpec
    lastCommit: number
}


type LogFrame<U extends AnyUpdate, D> = {
    aggr: Observable<D>,
    updates: Observable<U>,
    errors: Observable<Error>
}


interface Stratum {
    getLogFrames<U extends AnyUpdate, D>(ref: Ref, model: Model<U, D, any>) : Observable<LogFrame<U, D>>
}



type Confirm = {}





function createSpace(frames: Observable<Frame>) {

    //frames come f

    return {
        
    }
}



function createBase(): Stratum {


    return {
        getLogFrames<U extends AnyUpdate, D>(ref: Ref, model: Model<U, D, any>) : Observable<LogFrame<U, D>> {
            throw 123;
        }
    }
}


function createSlice(below: Stratum): Stratum {
    return {
        getLogFrames<U extends AnyUpdate, D>(ref: Ref, model: Model<U, D, any>) : Observable<LogFrame<U, D>> {
            const frames = below.getLogFrames(ref, model);
            //...

            return frames;
        }
    }
}


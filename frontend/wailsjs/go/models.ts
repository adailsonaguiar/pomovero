export namespace main {
	
	export class SessionLog {
	    id: number;
	    type: string;
	    duration: number;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new SessionLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.duration = source["duration"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Settings {
	    focusDuration: number;
	    breakDuration: number;
	    longBreakDuration: number;
	    longBreakInterval: number;
	    startSoundEnabled: boolean;
	    alarmSoundEnabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.focusDuration = source["focusDuration"];
	        this.breakDuration = source["breakDuration"];
	        this.longBreakDuration = source["longBreakDuration"];
	        this.longBreakInterval = source["longBreakInterval"];
	        this.startSoundEnabled = source["startSoundEnabled"];
	        this.alarmSoundEnabled = source["alarmSoundEnabled"];
	    }
	}

}


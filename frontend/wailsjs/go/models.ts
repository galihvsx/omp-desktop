export namespace main {
	
	export class SessionSummary {
	    id: string;
	    title: string;
	    cwd: string;
	    createdMs: number;
	    updatedMs: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.cwd = source["cwd"];
	        this.createdMs = source["createdMs"];
	        this.updatedMs = source["updatedMs"];
	    }
	}
	export class SessionGroup {
	    path: string;
	    name: string;
	    updatedMs: number;
	    sessions: SessionSummary[];
	
	    static createFrom(source: any = {}) {
	        return new SessionGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.updatedMs = source["updatedMs"];
	        this.sessions = this.convertValues(source["sessions"], SessionSummary);
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

}


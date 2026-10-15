export namespace main {
	
	export class GitStatus {
	    branch: string;
	    changed: number;
	    insertions: number;
	    deletions: number;
	
	    static createFrom(source: any = {}) {
	        return new GitStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.changed = source["changed"];
	        this.insertions = source["insertions"];
	        this.deletions = source["deletions"];
	    }
	}
	export class ModelOption {
	    provider: string;
	    id: string;
	    selector: string;
	    name: string;
	    reasoning: boolean;
	    thinking: string[];
	    contextWindow: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.id = source["id"];
	        this.selector = source["selector"];
	        this.name = source["name"];
	        this.reasoning = source["reasoning"];
	        this.thinking = source["thinking"];
	        this.contextWindow = source["contextWindow"];
	    }
	}
	export class SessionSummary {
	    id: string;
	    title: string;
	    cwd: string;
	    path: string;
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
	        this.path = source["path"];
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
	export class SessionInUse {
	    inUse: boolean;
	    updatedAgeMs: number;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionInUse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inUse = source["inUse"];
	        this.updatedAgeMs = source["updatedAgeMs"];
	        this.reason = source["reason"];
	    }
	}
	export class SessionPage {
	    messages: number[][];
	    total: number;
	    start: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SessionPage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messages = source["messages"];
	        this.total = source["total"];
	        this.start = source["start"];
	        this.hasMore = source["hasMore"];
	    }
	}
	
	export class SessionTranscript {
	    id: string;
	    title: string;
	    cwd: string;
	    created: number;
	    updated: number;
	    messages: number[][];
	
	    static createFrom(source: any = {}) {
	        return new SessionTranscript(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.cwd = source["cwd"];
	        this.created = source["created"];
	        this.updated = source["updated"];
	        this.messages = source["messages"];
	    }
	}
	export class StartOptions {
	    cwd: string;
	    resume: string;
	    model: string;
	    thinkingLevel: string;
	    approvalMode: string;
	
	    static createFrom(source: any = {}) {
	        return new StartOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cwd = source["cwd"];
	        this.resume = source["resume"];
	        this.model = source["model"];
	        this.thinkingLevel = source["thinkingLevel"];
	        this.approvalMode = source["approvalMode"];
	    }
	}

}


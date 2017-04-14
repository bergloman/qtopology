
/** Simple class for pattern matching */
export class PaternMatcher {

    pattern: any;

    /** Constructor that receives pattern as object */
    constructor(pattern: any) {
        this.pattern = JSON.parse(JSON.stringify(pattern));
        // prepare RegEx objects in advance
        for (let filter in this.pattern) {
            if (this.pattern.hasOwnProperty(filter)) {
                let curr = this.pattern[filter];
                if (typeof (curr) == "object" && curr.$like) {
                    if (Array.isArray(curr.$like)) {
                        for (let i = 0; i < curr.$like.length; i++) {
                            curr.$like[i] = new RegExp(curr.$like[i]);
                        }
                    } else if (typeof (curr.$like) == "string") {
                        curr.$like = new RegExp(curr.$like);
                    }
                }
            }
        }
    }

    /** Simple procedure for checking if given item
     *  matches the pattern.
     */
    isMatch(item) {
        for (let filter in this.pattern) {
            if (this.pattern.hasOwnProperty(filter)) {
                let curr = this.pattern[filter];
                if (Array.isArray(curr)) {
                    let match = false;
                    for (let filter1 of curr) {
                        if (item[filter] === filter1) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) {
                        return false;
                    }
                } else if (typeof (curr) == "object") {
                    if (curr.$like) {
                        if (Array.isArray(curr.$like)) {
                            let match = false;
                            for (let filter1 of curr.$like) {
                                if (filter1.test(item[filter])) {
                                    match = true;
                                    break;
                                }
                            }
                            if (!match) {
                                return false;
                            }
                        } else if (!curr.$like.test(item[filter])) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                } else {
                    if (item[filter] !== this.pattern[filter]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
}
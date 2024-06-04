class Functions {
    static uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
            .replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })
    }

    static arrayAreEquals(arr1, arr2) {
        if (arr1.length != arr2.length) return false

        for (let n in arr1)
            if (!arr2.includes(arr1[n]))
                return false
                    
        return true
    }
}
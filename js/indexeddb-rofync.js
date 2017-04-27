function IndexedDbRofync(database, version, tables) {
	// Attribute Database name
	this.database = database

	// Attribute tables array
	this.tables = tables

	// Attribute to register if the application is online or offline
	this.isOnline = true

	// Attribute to register if the backgroundSync is running
	this.executingBackgroundSync = false

	// Attribute database instance
	this.indexeddbRequest = window.indexedDB.open(database, version)

	// Attribute to get database opened
	this.db

	// Initialize all tasks
	this.start

	// Initialize database configurations task
	this.initializeDb

	// Check connection status task
	this.checkConnection

	// Background task
	this.backgroundSync

	// Sync task
	this.sync

	// Create function
	this.create

	// Read function
	this.read

	// Update function
	this.update

	// Delete function
	this.delete

	// List function
	this.list
}

IndexedDbRofync.prototype.start = function () {
	this.initializeDb().then(data => {
		console.log('Data base started:', data)
		this.checkConnection()
		this.backgroundSync()
	}).catch(error => {
		console.log(error)
	})
}

IndexedDbRofync.prototype.initializeDb = function () {
	return new Promise((resolve, reject) => {
		this.indexeddbRequest.onsuccess = e => {
			this.db = e.target.result
			resolve('ok')
		}

		this.indexeddbRequest.onupgradeneeded = e => {
			this.db = e.target.result

			this.tables.forEach(table => {
				if (!this.db.objectStoreNames.contains(table.name)) {
					let tableObject = this.db.createObjectStore(table.name, { keyPath: table.keyPath, autoIncrement: true })
					tableObject.createIndex(table.indexName, table.indexValue, { unique: false })
				}
			})

			resolve('ok')
		}

		this.indexeddbRequest.onerror = e => {
			reject(e.target.error.name)
		}
	})
}

IndexedDbRofync.prototype.checkConnection = function () {
	setInterval(() => {
		if (navigator.onLine) {
			this.isOnline = true
		} else {
			this.isOnline = false
		}
	}, 200)
}

IndexedDbRofync.prototype.backgroundSync = function () {
	setInterval(() => {
		if (this.isOnline && !this.executingBackgroundSync) {
			this.executingBackgroundSync = true
			this.tables.forEach(table => {
				let transaction = this.db.transaction([table.name], 'readwrite')
				let store = transaction.objectStore(table.name)
				let result = store.getAll()

				result.onsuccess = e => {
					let list = e.target.result
					list.forEach(item => {
						if (item.status === 'persisted') {
							this.sync(item, item.id, table.name)
						}
					})
				}
			})

			this.executingBackgroundSync = false
		}
	}, 5000)
}

IndexedDbRofync.prototype.create = function (data, table, remoteResource) {
	// Adding new attributes to object to save status and remoteResource for future tasks
	data.status = 'persisted'
	data.remoteResource = remoteResource

	let transaction = this.db.transaction([table], 'readwrite')
	let store = transaction.objectStore(table)
	let result = store.add(data)

	result.onerror = e => {
		console.log(e.target.error.name)
	}

	result.onsuccess = e => {
		this.sync(data, e.target.result, table)
	}
}

IndexedDbRofync.prototype.read = function (key, table) {
	let transaction = this.db.transaction([table], 'readwrite')
	let store = transaction.objectStore(table)
	let result = store.get(key)

	return new Promise((resolve, reject) => {
		result.onerror = e => {
			reject(e.target.error.name)
		}

		result.onsuccess = e => {
			resolve(e.target.result)
		}
	})
}

IndexedDbRofync.prototype.update = function (data, table) {
	let transaction = this.db.transaction([table], 'readwrite')
	let store = transaction.objectStore(table)
	let result = store.put(data)

	return new Promise((resolve, reject) => {
		result.onerror = e => {
			reject(e.target.error.name)
		}

		result.onsuccess = e => {
			resolve(e.target.result)
		}
	})
}

IndexedDbRofync.prototype.sync = function (data, key, table) {
	fetch(data.remoteResource, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	}).then(response => {
		if (response.ok) {
			this.read(key, table).then(oldData => {
				let newData = oldData
				newData.status = 'synchronized'
				this.update(newData, table).catch(error => console.log(error))
			}).catch(error => {
				console.log(error)
			})
		}
	}).catch(error => {
		console.log(error)
	})
}

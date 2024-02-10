var selectedListElem = null;

document.addEventListener("DOMContentLoaded", function () {
    onPopupLoaded();
});

async function getActiveTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function getCases(page) {
    const activeTab = await getActiveTab();

    try {
        return processResource(await chrome.tabs.sendMessage(
            activeTab.id,
            {
                "action": "getCases",
                "page": page
            }
        ));
    } catch (error) {
        return null
    }
}

async function getEpisodeDetail(episodeId) {
    const activeTab = await getActiveTab();

    try {
        return processResource(await chrome.tabs.sendMessage(
            activeTab.id,
            {
                "action": "getEpisodeDetail",
                "episodeId": episodeId
            }
        ));
    } catch (error) {
        return null
    }
}

async function getPatient() {
    const activeTab = await getActiveTab();
    try {
        return processResource(await chrome.tabs.sendMessage(
            activeTab.id,
            {
                "action": "getPatient"
            }
        ));
    } catch (error) {
        return null
    }
}

function processRelationshipItem(relationshipItem, includedMap, depth) {
    if (!(relationshipItem.type in includedMap)) {
        return relationshipItem;
    }
    if (!(relationshipItem.id in includedMap[relationshipItem.type])) {
        return relationshipItem;
    }
    const relationshipObject = includedMap[relationshipItem.type][relationshipItem.id];

    if (!('relationships' in relationshipObject)) {
        return relationshipObject
    }

    return {
        ...Object.keys(relationshipObject).filter(key => key != 'relationships').reduce((accumulator, key) => {
            return { ...accumulator, [key]: relationshipObject[key] }
        }, {}),
        relationships: processRelationships(relationshipObject.relationships, includedMap, depth + 1)
    }
}

function processRelationships(relationships, includedMap, depth = 1) {
    if (relationships === null) {
        return relationships
    }
    if (depth > 3) {
        return relationships
    }

    return Object.keys(relationships).reduce((accumulator, key) => {
        return {
            ...accumulator, [key]: ((relationship) => {
                if (relationship === null) {
                    return null
                }
                if (Array.isArray(relationship)) {
                    return {
                        data: relationship.map((relationshipItem) => {
                            return processRelationshipItem(relationshipItem, includedMap, depth)
                        })
                    }
                }
                return {
                    data: processRelationshipItem(relationship, includedMap, depth)
                }
            })(relationships[key].data)
        }
    }, {})

}

function processDataItem(dataItem, includedMap) {
    return {
        ...Object.keys(dataItem).filter((key) => { if (key !== 'relationships') { return key } }).reduce((accumulator, key) => {
            return { ...accumulator, [key]: dataItem[key] }
        }, {}),
        relationships: processRelationships(dataItem.relationships, includedMap)
    }
}

function processResourceData(data, includedMap) {
    if (data === null) {
        return null
    }

    if (Array.isArray(data)) {
        return data.map(dataItem => {
            return processDataItem(dataItem, includedMap)
        })
    }

    return processDataItem(data, includedMap);
}

function createIncludedMap(item) {
    var map = {};

    item.included.forEach((itemIncluded) => {
        if (!(itemIncluded.type in map)) {
            map[itemIncluded.type] = {}
        }
        map[itemIncluded.type][itemIncluded.id] = itemIncluded;
    })

    return map;
}

function processResource(resource) {
    if (resource === null) {
        return null
    }

    const includedMap = createIncludedMap(resource);

    return {
        meta: resource.meta,
        data: processResourceData(resource.data, includedMap)
    }
}

async function onPopupLoaded() {
    const listElement = document.getElementById("list");
    listElement.innerHTML = `<div id="loading">Loading...</div>`;

    const patient = await getPatient();

    if (patient === null) {
        const contentElement = document.getElementById("content");
        contentElement.innerHTML = `<div id="error">Not found</div>`;
        return
    }

    showPatientInfo(patient)

    const cases = await getCases(1);

    if (cases === null) {
        listElement.innerHTML = `<div id="error">Not found</div>`;
        return
    }

    const casesElement = await createCasesElement(cases);

    listElement.innerHTML = "";
    listElement.appendChild(casesElement);

    listElement.onscroll = () => {
        const moreButton = document.getElementById("more-button");

        if (moreButton == null) {
            return;
        }

        var rect = moreButton.getBoundingClientRect();

        const windowHeight = (window.innerHeight || document.documentElement.clientHeight);

        const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);

        if (vertInView) {
            moreButton.click();
        }

    }
}

function getAge(dateOfBirth) {
    const diff_ms = Date.now() - dateOfBirth;
    const age_dt = new Date(diff_ms);
    const years = diff_ms / 1000 / 3600 / 24 / 365;
    const months = years % 1 * 12;
    if (years < 1) {
        return `${Math.floor(months)} months`;
    }
    return `${Math.floor(years)} years ${Math.floor(months)} months`;
}

function showPatientInfo(patient) {
    document.getElementById("patient-name").innerText = patient.data.attributes.patient_name;
    document.getElementById("patient-age").innerText = getAge(Date.parse(patient.data.attributes.birth_date));
    document.getElementById("patient-nid").innerText = patient.data.attributes.national_identification;
    document.getElementById("patient-sex").innerText = patient.data.attributes.gender;
    document.getElementById("patient-dob").innerText = patient.data.attributes.birth_date;
}

async function createCaseItems(cases, addMoreListElements) {
    const caseElements = cases.data.map((patientCase) => {
        const doctor = patientCase.relationships.doctor.data.attributes;

        const caseElement = document.createElement("li");

        const headerElement = document.createElement("div");
        headerElement.innerHTML = `<span>case</span><span>${patientCase.attributes.created_at}</span><span>${doctor.fullname}</span>`;
        caseElement.append(headerElement);

        const detailsElement = document.createElement("div");
        caseElement.appendChild(detailsElement);

        const episodesElement = document.createElement("ul");
        detailsElement.append(episodesElement)

        episodesElement.append(...patientCase.relationships.episodes.data.map((episode) => {
            const doctor = episode.relationships.doctor.data.attributes;

            const el = document.createElement("li");
            el.innerHTML = `<span>episode</span><span>${episode.attributes.created_at}</span><span>${doctor.fullname}</span>`;

            el.onclick = async () => {
                if (selectedListElem !== null) {
                    selectedListElem.classList.remove("selected");
                }
                selectedListElem = el;
                selectedListElem.classList.add("selected");

                const detailElement = document.getElementById("detail");

                detailElement.innerHTML = "Loading..."

                const episodeDetail = await getEpisodeDetail(episode.id);

                const episodeDetailElement = await createEpisodeDetailElement(episodeDetail);

                detailElement.innerHTML = "";
                detailElement.appendChild(episodeDetailElement);
            }

            return el;
        }))
        return caseElement;
    })

    if (cases.meta.last_page > cases.meta.current_page) {
        const moreButton = document.createElement("li");
        moreButton.className = "load-more"
        moreButton.innerHTML = "Load more";
        moreButton.onclick = async () => {
            moreButton.innerHTML = "Loading...";
            moreButton.onclick = () => { };
            const moreCases = await getCases(cases.meta.current_page + 1);
            moreButton.remove();
            if (moreCases === null) {
                const failedEl = document.createElement('li');
                failedEl.className = "failed-load";
                failedEl.innerHTML = "Failed to load more";
                addMoreListElements([failedEl]);
                return
            }
            addMoreListElements((await createCaseItems(moreCases, addMoreListElements)))
        }
        moreButton.setAttribute("id", "more-button");

        return caseElements.concat([moreButton])
    }

    return caseElements
}

async function createCasesElement(cases) {
    const casesElement = document.createElement("ul");
    casesElement.append(...(await createCaseItems(cases, (moreListElements) => {
        casesElement.append(...moreListElements);
    })));

    return casesElement
}

async function createEpisodeDetailElement(episode) {
    const doctor = episode.data.relationships.doctor.data.attributes;

    const detailElement = document.createElement("div");

    const episodeId = episode.data.id;
    const patientId = episode.data.relationships.patient.data.id;

    const episodeHeading = document.createElement("h2");
    episodeHeading.innerHTML = `<span>Episode</span>` +
        `<a title="Open episode" target="_blank" href="https://vinavi.aasandha.mv/#/patients/${patientId}/episodes/${episodeId}"></a>`;

    const episodeInfo = document.createElement("ul");
    episodeInfo.className = 'episode-info';
    episodeInfo.innerHTML = `<li><span>created at</span><span>${episode.data.attributes.created_at}</span></li>` +
        `<li><span>visited on</span><span>${episode.data.attributes.visited_on}</span></li>` +
        `<li><span>doctor</span><span>${doctor.fullname}</span></li>`

    detailElement.append(
        episodeHeading,
        episodeInfo,
        ...createDiagnosisList(episode),
        ...createNoteList(episode),
        ...createPrescriptionList(episode)
    )

    return detailElement;
}


function createNoteList(episode) {
    if (episode.data.relationships.notes.data.length < 1) {
        return []
    }

    const noteHeading = document.createElement("h2");
    noteHeading.innerHTML = "Notes";

    const noteList = document.createElement("ul");
    noteList.className = "notes-list";
    noteList.append(...episode.data.relationships.notes.data.map((note) => {
        const el = document.createElement("li");
        el.classList = ['note', note.attributes.note_type]
        el.innerHTML = `<span>${note.attributes.note_type}</span><span>${note.attributes.notes}</span>`
        return el
    }))

    return [noteHeading, noteList];
}


function createDiagnosisList(episode) {
    if (episode.data.relationships.diagnoses.data.length < 1) {
        return []
    }

    const diagnosisHeading = document.createElement("h2");
    diagnosisHeading.innerHTML = "Diagnosis";


    const diagnosisList = document.createElement("ul");
    diagnosisList.className = 'diagnosis-list';
    diagnosisList.append(...episode.data.relationships.diagnoses.data.map((diagnosis) => {
        const el = document.createElement("li");
        el.innerHTML = `<span>${diagnosis.attributes['icd-code'].code}</span>` +
            `<span>${diagnosis.attributes['icd-code'].title}</span>` +
            `<span>${(diagnosis.attributes.remarks === null) ? "" : diagnosis.attributes.remarks}</span>`;

        return el;
    }));

    return [diagnosisHeading, diagnosisList];
}


function createPrescriptionList(episode) {
    if (episode.data.relationships.prescriptions.data.length < 1) {
        return [];
    }

    const presciptionHeading = document.createElement("h2");
    presciptionHeading.innerHTML = "Prescription";

    const prescriotionList = document.createElement("ul");
    prescriotionList.className = "prescription-list";
    prescriotionList.append(...episode.data.relationships.prescriptions.data.map((prescriptionItem) => {
        const prescElement = document.createElement("li");
        prescElement.innerHTML = `<div><span>created at</span> <span>${prescriptionItem.attributes.created_at}</span></div>`;

        const medicineList = document.createElement("ol");
        medicineList.append(...prescriptionItem.relationships.medicines.data.map((prescription_medicine) => {
            const el = document.createElement("li");

            if (prescription_medicine.relationships['preferred-medicine'] !== null) {
                const preferred_medicine = prescription_medicine.relationships['preferred-medicine'].data;
                el.innerHTML = `<span>${preferred_medicine.attributes.preparation}</span> ` +
                    `<span class="medicine-name">${preferred_medicine.attributes.name}</span> ` +
                    `<span>${preferred_medicine.attributes.strength}</span> ` +
                    `<span>${prescription_medicine.attributes.instructions}</span>`;
            } else {
                el.innerHTML = `<span class="medicine-name">${prescription_medicine.attributes.name}</span> ` +
                    `<span>${prescription_medicine.attributes.instructions}</span>`;
            }

            return el;
        }))
        medicineList.append(...prescriptionItem.relationships.consumables.data.map((medicineData) => {
            const el = document.createElement("li");
            el.innerHTML = "? consumable"
            return el;
        }))


        prescElement.append(medicineList);
        return prescElement;
    }));

    return [presciptionHeading, prescriotionList];
}
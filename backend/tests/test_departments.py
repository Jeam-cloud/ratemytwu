def test_department_empty_list(client):
    response = client.get("/department")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_department_professors_empty_list(client):
    response = client.get("/department/test_department/professors")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_department_courses_empty_list(client):
    response = client.get("/department/test_department/courses")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
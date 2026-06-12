def test_course_empty_list(client):
    response = client.get("/course/?search_course=i am not a course")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_course_does_not_exist(client):
    response = client.get("/course/9999")
    assert response.status_code == 404